This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Referencia automática de SPEC para inspecciones de entrada

- Configurar `BOX_MTS_SPECS_FOLDER_ID=<ID_DE_CARPETA_SPECS_MTS>` en Vercel (Production y Preview según corresponda). Es la carpeta **Approved SPECS MTS**, distinta de `BOX_MTS_FOLDER_ID`, que contiene las WI. Desplegar nuevamente tras agregar la variable.
- Para proyectos no se necesita un ID por proyecto: se localizan las carpetas `SPECs` (también `SEPCs`) dentro del DMR seleccionado.
- La cuenta de servicio de Box debe tener acceso de lectura a esas carpetas. La búsqueda recorre sus subcarpetas, excluye editables/ePhotocopies/borradores/obsoletos y conserva la revisión numérica más alta de la SPEC que coincide con el código de la WI.
- La referencia obtenida se guarda al crear el lote. No se actualizan automáticamente los lotes históricos. Si no hay configuración, permiso o coincidencia inequívoca, el formulario informa el motivo y permite capturar la referencia manualmente.
