from gt_flask import t, derive

# Simple ternary
a = t(f"It is {derive('day' if is_day() else 'night')}!")

# Nested ternary (3 branches)
b = t(f"{derive('a' if x else 'b' if y else 'c')}")

# Plain string in derive
c = t(f"Hello {derive('world')}!")
