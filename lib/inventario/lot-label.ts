import PizZip from "pizzip";
import QRCode from "qrcode";
import { formatQmsDate } from "@/lib/inspections/qmsDate";
import type { InventoryComponent, Lot } from "./types";

export const LOT_LABEL_TEMPLATE = "public/templates/Formato_Control de inspección.lbx";

function escapeXml(value: string) {
  return value.replace(/[&<>]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]!);
}

function qrObject(url: string) {
  const cellSize = 2;
  const size = (QRCode.create(url, { errorCorrectionLevel: "M" }).modules.size + 8) * cellSize;
  // The QR is a floating object centered over the template's merged right-hand cell.
  const x = (355.25 - size / 2).toFixed(2);
  const y = (94.75 - size / 2).toFixed(2);
  return `<barcode:barcode><pt:objectStyle x="${x}pt" y="${y}pt" width="${size}pt" height="${size}pt" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE"><pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"/><pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/><pt:expanded objectName="QR del componente" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" templateMergeID="0" linkStatus="NONE" linkID="0"/></pt:objectStyle><barcode:barcodeStyle protocol="QRCODE" lengths="${url.length}" zeroFill="false" barWidth="1.2pt" barRatio="1:3" humanReadable="false" humanReadableAlignment="LEFT" checkDigit="true" autoLengths="false" margin="false" sameLengthBar="false" bearerBar="false"/><pt:data>${escapeXml(url)}</pt:data><barcode:qrcodeStyle model="2" eccLevel="15%" cellSize="${cellSize}pt" mbcs="932" removeCharKind="0" removeCharString="" joint="1" jointSpace="8" jointVertically="false" version="auto" changeVersionDrag="false"/></barcode:barcode>`;
}

export function renderLotLabel(
  template: Buffer,
  component: Pick<InventoryComponent, "name" | "code" | "unit">,
  lot: Pick<Lot, "name" | "expiry" | "createdAt">,
  initialQuantity: number | undefined,
  componentUrl: string,
) {
  const received = /^\d{4}-\d{2}-\d{2}$/.test(lot.createdAt)
    ? lot.createdAt
    : new Date(lot.createdAt);
  const values = new Map([
    ["NOMBRE_COMPONENTE", component.name],
    ["NUMERO_PARTE", component.code],
    ["LOTE", lot.name],
    ["CANTIDAD", initialQuantity === undefined ? "" : `${initialQuantity} ${component.unit}`],
    ["FECHA_EXPIRACION", lot.expiry ? formatQmsDate(lot.expiry).toLowerCase() : "No aplica"],
    ["FECHA_RECIBIDO", formatQmsDate(received).toLowerCase()],
  ]);

  const zip = new PizZip(template);
  const source = zip.file("label.xml")?.asText();
  if (!source) throw new Error("La plantilla de etiqueta no contiene label.xml.");
  let qrFound = false;
  const xml = source.replace(/<text:text(?:\s[^>]*)?>[\s\S]*?<\/text:text>/g, object => {
    if (object.includes("<pt:data>QR_COMPONENTE</pt:data>")) {
      qrFound = true;
      return "";
    }
    const marker = /<pt:data>(\s*)\{\{([A-Z_]+)\}\}<\/pt:data>/.exec(object);
    if (!marker || !values.has(marker[2])) return object;

    const value = values.get(marker[2])!;
    values.delete(marker[2]);
    const data = value ? marker[1] + value : "";
    const runs = /<text:stringItem charLen="\d+">([\s\S]*?)<\/text:stringItem>/g;
    const font = [...object.matchAll(runs)][0]?.[1];
    if (!font) throw new Error(`La plantilla de etiqueta no tiene estilo para ${marker[2]}.`);
    // P-touch stores the length of each formatted run alongside the label text.
    const run = `<text:stringItem charLen="${data.length}">${font}</text:stringItem>`;
    return object.replace(runs, "").replace(marker[0], () => `<pt:data>${escapeXml(data)}</pt:data>${run}`);
  });

  if (values.size || !qrFound || !xml.includes("</pt:objects>")) {
    throw new Error("La plantilla de etiqueta no contiene todos los campos esperados.");
  }
  zip.file("label.xml", xml.replace("</pt:objects>", () => `${qrObject(componentUrl)}</pt:objects>`));
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
