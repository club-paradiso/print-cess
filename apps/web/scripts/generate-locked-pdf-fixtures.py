"""Regenerates the password-protected PDF fixtures used by unlock-pdf tests.

Run from the repository root:  python3 apps/web/scripts/generate-locked-pdf-fixtures.py
Requires pypdf (and `cryptography` for AES). The fixtures are synthetic one-page
documents; they contain no real personal data.
"""

from pathlib import Path

from pypdf import PdfWriter
from pypdf.constants import UserAccessPermissions as P

OUT = Path(__file__).resolve().parent.parent / "test" / "fixtures" / "locked-pdf"
OUT.mkdir(parents=True, exist_ok=True)

ALL = P.PRINT | P.PRINT_TO_REPRESENTATION | P.EXTRACT | P.MODIFY | P.ADD_OR_MODIFY
NO_PRINT = P.EXTRACT | P.MODIFY | P.ADD_OR_MODIFY


def page_writer(pages: int = 2) -> PdfWriter:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=595.28, height=841.89)
    return writer


def save(name: str, **encrypt) -> None:
    writer = page_writer()
    writer.encrypt(**encrypt)
    with open(OUT / name, "wb") as handle:
        writer.write(handle)


save("user-aes256.pdf", user_password="0401", owner_password="owner-secret",
     algorithm="AES-256", permissions_flag=ALL)
save("user-rc4.pdf", user_password="0401", owner_password="owner-secret",
     algorithm="RC4-128", permissions_flag=ALL)
save("owner-print-allowed.pdf", user_password="", owner_password="owner-secret",
     algorithm="AES-128", permissions_flag=ALL)
save("owner-print-blocked.pdf", user_password="", owner_password="owner-secret",
     algorithm="AES-128", permissions_flag=NO_PRINT)
save("user-print-blocked.pdf", user_password="0401", owner_password="owner-secret",
     algorithm="AES-256", permissions_flag=NO_PRINT)
