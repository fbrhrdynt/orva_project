import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], row: T) => ReactNode;
  align?: "left" | "right";
};

export function DataTable<T extends { id: string }>({ columns, rows, emptyMessage = "No records to display" }: { columns: DataTableColumn<T>[]; rows: T[]; emptyMessage?: string }) {
  return (
    <div className="orva-table-wrap">
      <table className="orva-table">
        <thead><tr>{columns.map((column) => <th key={String(column.key)} className={column.align === "right" ? "is-right" : ""} scope="col">{column.header}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((row) => <tr key={row.id}>{columns.map((column) => <td key={String(column.key)} className={column.align === "right" ? "is-right" : ""}>{column.render ? column.render(row[column.key], row) : String(row[column.key] ?? "")}</td>)}</tr>) : <tr><td colSpan={columns.length} className="orva-table__empty">{emptyMessage}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}