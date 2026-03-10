from gt_flask import t, declare_static

# String concatenation directly inside declare_static
a = t(f"Hello, {declare_static('a' + 'b')}!")
