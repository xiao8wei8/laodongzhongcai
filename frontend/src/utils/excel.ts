import * as XLSX from 'xlsx';
import { message } from 'antd';

export interface ExcelColumn<T> {
  header: string;
  key: keyof T | string;
  formatter?: (row: T) => string | number | boolean | null | undefined;
}

export interface ExcelSheet<T> {
  name: string;
  columns: ExcelColumn<T>[];
  rows: T[];
}

const sanitizeSheetName = (name: string) => name.replace(/[\\/?*:[\]]/g, '').slice(0, 31) || 'Sheet1';

const normalizeCellValue = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
};

export const buildExcelRows = <T>(columns: ExcelColumn<T>[], rows: T[]) => {
  return rows.map((row) => {
    const nextRow: Record<string, unknown> = {};
    columns.forEach((column) => {
      const value = column.formatter
        ? column.formatter(row)
        : (row as Record<string, unknown>)[String(column.key)];
      nextRow[column.header] = normalizeCellValue(value);
    });
    return nextRow;
  });
};

export const exportExcel = <T>(fileName: string, columns: ExcelColumn<T>[], rows: T[]) => {
  const worksheet = XLSX.utils.json_to_sheet(buildExcelRows(columns, rows));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '导出结果');
  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
};

export const exportExcelWorkbook = (fileName: string, sheets: ExcelSheet<any>[]) => {
  const workbook = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.json_to_sheet(buildExcelRows(sheet.columns, sheet.rows));
    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheet.name));
  });
  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
};

export const buildExportFileName = (prefix: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${prefix}_${year}-${month}-${day}.xlsx`;
};

export const warnNoExportData = (label: string = '当前没有可导出的数据') => {
  message.warning(label);
};
