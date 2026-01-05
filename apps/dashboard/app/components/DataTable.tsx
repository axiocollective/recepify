type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
};

type DataTableProps<T> = {
  title: string;
  columns: Array<Column<T>>;
  rows: T[];
  emptyLabel?: string;
};

export function DataTable<T>({ title, columns, rows, emptyLabel }: DataTableProps<T>) {
  return (
    <div className="tableCard">
      <div className="tableHeader">
        <h3>{title}</h3>
        <span>{rows.length} rows</span>
      </div>
      <div className="tableScroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <div className="tableEmpty">{emptyLabel ?? "No data yet."}</div> : null}
      </div>
    </div>
  );
}
