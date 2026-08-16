import json
import sqlite3
import sys
from pathlib import Path

source = Path(sys.argv[1]).resolve()
target = Path(sys.argv[2]).resolve()
tables = [
    "calculos", "productos", "inventario", "movimientos", "vendedores",
    "clientes", "facturas", "factura_items", "pagos", "caja_movimientos",
    "proveedores", "compras_proveedor", "pagos_proveedor", "protocolos",
    "salidas_internas", "pagos_salidas_internas", "ventas", "configuracion",
]
connection = sqlite3.connect(source)
connection.row_factory = sqlite3.Row
payload = {"source": str(source), "tables": {}}
for table in tables:
    payload["tables"][table] = [dict(row) for row in connection.execute(f'SELECT * FROM "{table}"')]
target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print(target)
