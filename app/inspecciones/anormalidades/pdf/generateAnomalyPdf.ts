import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";

import type {
  AnomalyDecision,
  AnomalyOccurrence,
  InspectionAnomaly,
} from "../types";

type GenerateAnomalyPdfParams = {
  anomaly: InspectionAnomaly;
  occurrences: AnomalyOccurrence[];
  componentName: string;
  idToken: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const MARGIN_X = 48;
const TOP_MARGIN = 52;
const BOTTOM_MARGIN = 48;

const CONTENT_WIDTH =
  PAGE_WIDTH - MARGIN_X * 2;

const PHOTO_GAP = 12;

const PHOTO_WIDTH =
  (
    CONTENT_WIDTH -
    PHOTO_GAP
  ) / 2;

const PHOTO_MAX_HEIGHT = 190;

function cleanText(
  value: unknown,
) {
  return String(value ?? "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\t/g, " ")
    .trim();
}

function safeFileName(
  value: string,
) {
  return value
    .trim()
    .replace(
      /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ._-]/g,
      "_",
    )
    .replace(/_+/g, "_");
}

function timestampValue(
  value: unknown,
) {
  if (!value) return 0;

  const candidate =
    value as {
      toMillis?: () => number;
      seconds?: number;
    };

  if (
    typeof candidate.toMillis ===
    "function"
  ) {
    return candidate.toMillis();
  }

  if (
    typeof candidate.seconds ===
    "number"
  ) {
    return (
      candidate.seconds * 1000
    );
  }

  const parsed =
    new Date(
      String(value),
    ).getTime();

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

function sortOccurrences(
  occurrences:
    AnomalyOccurrence[],
) {
  return [...occurrences].sort(
    (first, second) =>
      timestampValue(
        first.createdAt,
      ) -
      timestampValue(
        second.createdAt,
      ),
  );
}

function translateDecision(
  decision: AnomalyDecision,
) {
  if (decision === "pass") {
    return "Pasó";
  }

  if (decision === "fail") {
    return "No pasó";
  }

  return "Pendiente";
}

function wrapText(
  textValue: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
) {
  const paragraphs =
    cleanText(textValue).split(
      /\r?\n/,
    );

  const lines: string[] = [];

  paragraphs.forEach(
    (
      paragraph,
      paragraphIndex,
    ) => {
      const words =
        paragraph
          .split(/\s+/)
          .filter(Boolean);

      if (words.length === 0) {
        lines.push("");
        return;
      }

      let currentLine = "";

      words.forEach((word) => {
        const candidate =
          currentLine
            ? `${currentLine} ${word}`
            : word;

        const width =
          font.widthOfTextAtSize(
            candidate,
            fontSize,
          );

        if (
          width <= maxWidth ||
          !currentLine
        ) {
          currentLine =
            candidate;
          return;
        }

        lines.push(currentLine);
        currentLine = word;
      });

      if (currentLine) {
        lines.push(currentLine);
      }

      if (
        paragraphIndex <
        paragraphs.length - 1
      ) {
        lines.push("");
      }
    },
  );

  return lines;
}

function drawWrappedText({
  page,
  text,
  x,
  y,
  font,
  fontSize,
  color,
  maxWidth,
  lineHeight,
}: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  font: PDFFont;
  fontSize: number;
  color: ReturnType<typeof rgb>;
  maxWidth: number;
  lineHeight: number;
}) {
  const lines =
    wrapText(
      text,
      font,
      fontSize,
      maxWidth,
    );

  lines.forEach(
    (line, index) => {
      if (!line) return;

      page.drawText(line, {
        x,
        y:
          y -
          index * lineHeight,
        size: fontSize,
        font,
        color,
      });
    },
  );

  return (
    y -
    lines.length * lineHeight
  );
}

async function convertBlobToJpeg(
  blob: Blob,
) {
  const imageUrl =
    URL.createObjectURL(blob);

  try {
    const image =
      await new Promise<
        HTMLImageElement
      >(
        (
          resolve,
          reject,
        ) => {
          const element =
            new Image();

          element.onload = () =>
            resolve(element);

          element.onerror = () =>
            reject(
              new Error(
                "No fue posible procesar una imagen.",
              ),
            );

          element.src =
            imageUrl;
        },
      );

    const canvas =
      document.createElement(
        "canvas",
      );

    canvas.width =
      image.naturalWidth;

    canvas.height =
      image.naturalHeight;

    const context =
      canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "No fue posible preparar la fotografía.",
      );
    }

    context.fillStyle =
      "#ffffff";

    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    context.drawImage(
      image,
      0,
      0,
    );

    const jpegBlob =
      await new Promise<Blob>(
        (
          resolve,
          reject,
        ) => {
          canvas.toBlob(
            (result) => {
              if (result) {
                resolve(result);
              } else {
                reject(
                  new Error(
                    "No fue posible convertir la fotografía.",
                  ),
                );
              }
            },
            "image/jpeg",
            0.9,
          );
        },
      );

    return new Uint8Array(
      await jpegBlob.arrayBuffer(),
    );
  } finally {
    URL.revokeObjectURL(
      imageUrl,
    );
  }
}

async function loadPdfImage(
  pdfDocument: PDFDocument,
  storagePath: string,
  idToken: string,
): Promise<PDFImage> {
  const query =
    new URLSearchParams({
      path: storagePath,
    });

  const response =
    await fetch(
      "/api/inspections/" +
        "anomalies/image" +
        `?${query.toString()}`,
      {
        headers: {
          Authorization:
            `Bearer ${idToken}`,
        },
      },
    );

  if (!response.ok) {
    const result =
      await response
        .json()
        .catch(() => null);

    throw new Error(
      result?.error ||
      "No fue posible descargar una fotografía.",
    );
  }

  const blob =
    await response.blob();

  const bytes =
    new Uint8Array(
      await blob.arrayBuffer(),
    );

  const contentType =
    blob.type.toLowerCase();

  if (
    contentType.includes("png")
  ) {
    return pdfDocument.embedPng(
      bytes,
    );
  }

  if (
    contentType.includes("jpeg") ||
    contentType.includes("jpg")
  ) {
    return pdfDocument.embedJpg(
      bytes,
    );
  }

  const jpegBytes =
    await convertBlobToJpeg(
      blob,
    );

  return pdfDocument.embedJpg(
    jpegBytes,
  );
}

function getImageDimensions(
  image: PDFImage,
) {
  const scale = Math.min(
    PHOTO_WIDTH / image.width,
    PHOTO_MAX_HEIGHT /
      image.height,
    1,
  );

  return {
    width:
      image.width * scale,

    height:
      image.height * scale,
  };
}

function downloadPdf(
  bytes: Uint8Array,
  fileName: string,
) {
  const arrayBuffer =
    new ArrayBuffer(
      bytes.byteLength,
    );

  new Uint8Array(
    arrayBuffer,
  ).set(bytes);

  const blob =
    new Blob(
      [arrayBuffer],
      {
        type:
          "application/pdf",
      },
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = fileName;

  document.body.appendChild(
    link,
  );

  link.click();
  link.remove();

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        url,
      );
    },
    1000,
  );
}

export async function generateAnomalyPdf({
  anomaly,
  occurrences,
  componentName,
  idToken,
}: GenerateAnomalyPdfParams) {
  if (occurrences.length === 0) {
    throw new Error(
      "Selecciona al menos un reporte.",
    );
  }

  const pdfDocument =
    await PDFDocument.create();

  const regularFont =
    await pdfDocument.embedFont(
      StandardFonts.Helvetica,
    );

  const boldFont =
    await pdfDocument.embedFont(
      StandardFonts.HelveticaBold,
    );

  const orderedOccurrences =
    sortOccurrences(
      occurrences,
    );

  let page =
    pdfDocument.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);

  let y =
    PAGE_HEIGHT -
    TOP_MARGIN;

  const addPage = () => {
    page =
      pdfDocument.addPage([
        PAGE_WIDTH,
        PAGE_HEIGHT,
      ]);

    y =
      PAGE_HEIGHT -
      TOP_MARGIN;
  };

  const ensureSpace = (
    requiredHeight: number,
  ) => {
    if (
      y - requiredHeight <
      BOTTOM_MARGIN
    ) {
      addPage();
    }
  };

  page.drawText(
    "REPORTE DE ANORMALIDAD",
    {
      x: MARGIN_X,
      y,
      size: 17,
      font: boldFont,
      color: rgb(
        0.04,
        0.38,
        0.29,
      ),
    },
  );

  y -= 31;

  y = drawWrappedText({
    page,
    text:
      anomaly.title ||
      "Anormalidad sin título",
    x: MARGIN_X,
    y,
    font: boldFont,
    fontSize: 20,
    color: rgb(
      0.08,
      0.1,
      0.1,
    ),
    maxWidth:
      CONTENT_WIDTH,
    lineHeight: 24,
  });

  y -= 12;

  y = drawWrappedText({
    page,
    text:
      `Componente: ${componentName}`,
    x: MARGIN_X,
    y,
    font: boldFont,
    fontSize: 11,
    color: rgb(
      0.2,
      0.22,
      0.22,
    ),
    maxWidth:
      CONTENT_WIDTH,
    lineHeight: 15,
  });

  y -= 10;

  page.drawText(
    `Decisión: ${translateDecision(
      anomaly.decision,
    )}`,
    {
      x: MARGIN_X,
      y,
      size: 10.5,
      font: regularFont,
      color:
        anomaly.decision ===
        "fail"
          ? rgb(
              0.65,
              0.13,
              0.13,
            )
          : rgb(
              0.25,
              0.3,
              0.29,
            ),
    },
  );

  y -= 24;

  page.drawLine({
    start: {
      x: MARGIN_X,
      y,
    },
    end: {
      x:
        PAGE_WIDTH -
        MARGIN_X,
      y,
    },
    thickness: 1,
    color: rgb(
      0.82,
      0.84,
      0.84,
    ),
  });

  y -= 28;

  for (
    let reportIndex = 0;
    reportIndex <
    orderedOccurrences.length;
    reportIndex += 1
  ) {
    const occurrence =
      orderedOccurrences[
        reportIndex
      ];

    ensureSpace(135);

    page.drawText(
      `REPORTE ${reportIndex + 1}`,
      {
        x: MARGIN_X,
        y,
        size: 9,
        font: boldFont,
        color: rgb(
          0.72,
          0.12,
          0.12,
        ),
      },
    );

    y -= 20;

    y = drawWrappedText({
      page,
      text:
        `Lote: ${occurrence.lot}`,
      x: MARGIN_X,
      y,
      font: boldFont,
      fontSize: 13,
      color: rgb(
        0.08,
        0.1,
        0.1,
      ),
      maxWidth:
        CONTENT_WIDTH,
      lineHeight: 17,
    });

    y -= 5;

    page.drawText(
      `Muestra ${occurrence.affectedQuantity} de ${occurrence.sampleQuantity}`,
      {
        x: MARGIN_X,
        y,
        size: 10.5,
        font: regularFont,
        color: rgb(
          0.35,
          0.38,
          0.38,
        ),
      },
    );

    y -= 22;

    y = drawWrappedText({
      page,
      text:
        occurrence.description,
      x: MARGIN_X,
      y,
      font: regularFont,
      fontSize: 10.5,
      color: rgb(
        0.2,
        0.22,
        0.22,
      ),
      maxWidth:
        CONTENT_WIDTH,
      lineHeight: 15,
    });

    y -= 15;

    for (
      let photoIndex = 0;
      photoIndex <
      occurrence.photos.length;
      photoIndex += 2
    ) {
      const currentPhotos =
        occurrence.photos.slice(
          photoIndex,
          photoIndex + 2,
        );

      const loadedImages =
        await Promise.all(
          currentPhotos.map(
            async (photo) => {
              try {
                return await loadPdfImage(
                  pdfDocument,
                  photo.storagePath,
                  idToken,
                );
              } catch (
                imageError
              ) {
                console.error(
                  "No se pudo agregar una fotografía al PDF:",
                  imageError,
                );

                return null;
              }
            },
          ),
        );

      const validImages =
        loadedImages.filter(
          (
            image,
          ): image is PDFImage =>
            image !== null,
        );

      if (
        validImages.length === 0
      ) {
        continue;
      }

      const dimensions =
        validImages.map(
          getImageDimensions,
        );

      const rowHeight =
        Math.max(
          ...dimensions.map(
            (item) =>
              item.height,
          ),
        );

      ensureSpace(
        rowHeight + 18,
      );

      validImages.forEach(
        (
          image,
          imageIndex,
        ) => {
          const size =
            dimensions[
              imageIndex
            ];

          const columnX =
            MARGIN_X +
            imageIndex *
              (
                PHOTO_WIDTH +
                PHOTO_GAP
              );

          page.drawImage(
            image,
            {
              x:
                columnX +
                (
                  PHOTO_WIDTH -
                  size.width
                ) /
                  2,
              y:
                y -
                size.height,
              width:
                size.width,
              height:
                size.height,
            },
          );
        },
      );

      y -=
        rowHeight + 16;
    }

    y -= 8;

    if (
      reportIndex <
      orderedOccurrences.length -
        1
    ) {
      ensureSpace(25);

      page.drawLine({
        start: {
          x: MARGIN_X,
          y,
        },
        end: {
          x:
            PAGE_WIDTH -
            MARGIN_X,
          y,
        },
        thickness: 0.7,
        color: rgb(
          0.86,
          0.87,
          0.87,
        ),
      });

      y -= 25;
    }
  }

  const pdfBytes =
    await pdfDocument.save();

  const fileName =
    safeFileName(
      `Anormalidad_${
        anomaly.title ||
        "sin_titulo"
      }`,
    ) + ".pdf";

  downloadPdf(
    pdfBytes,
    fileName,
  );
}