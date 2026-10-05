"""Generate password.pdf (AES-encrypted, user password: test123) from simple.pdf.

Requires: pip install pypdf
The committed binary is used by tests; this script reproduces it.
"""
from pathlib import Path
from pypdf import PdfReader, PdfWriter

HERE = Path(__file__).resolve().parent
reader = PdfReader(str(HERE / "simple.pdf"))
writer = PdfWriter()
for page in reader.pages:
    writer.add_page(page)
writer.encrypt("test123")
with open(HERE / "password.pdf", "wb") as f:
    writer.write(f)
print("wrote password.pdf")
