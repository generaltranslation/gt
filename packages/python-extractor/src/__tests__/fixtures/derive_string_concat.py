from gt_flask import t, derive

# String concatenation directly inside derive
a = t(f"Hello, {derive('a' + 'b')}!")
