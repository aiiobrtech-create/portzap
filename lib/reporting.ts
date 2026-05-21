import "server-only";

function escapeCsvCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = String(value).replace(/"/g, '""');

  return /[",\n\r;]/.test(normalized) ? `"${normalized}"` : normalized;
}

export function buildCsv(rows: Array<Record<string, string | number | boolean | null | undefined>>) {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvCell(row[header])).join(","));
  }

  return `\ufeff${lines.join("\n")}`;
}

export function csvResponse(filename: string, csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function escapeXmlCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildExcelXml(rows: Array<Record<string, string | number | boolean | null | undefined>>) {
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const tableRows = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header])),
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Encomendas">
    <Table>
      ${tableRows
        .map(
          (row) =>
            `<Row>${row
              .map((cell) => `<Cell><Data ss:Type="String">${escapeXmlCell(cell)}</Data></Cell>`)
              .join("")}</Row>`,
        )
        .join("")}
    </Table>
  </Worksheet>
</Workbook>`;
}

export function excelResponse(filename: string, xml: string) {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
