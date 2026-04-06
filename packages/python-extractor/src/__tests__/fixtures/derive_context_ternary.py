from gt_flask import t, derive

a = t("Hello", _context=derive("formal" if x else "casual"))
