from gt_flask import t, declare_static

# Simple ternary
a = t(f"It is {declare_static('day' if is_day() else 'night')}!")

# Nested ternary (3 branches)
b = t(f"{declare_static('a' if x else 'b' if y else 'c')}")

# Plain string in declare_static
c = t(f"Hello {declare_static('world')}!")
