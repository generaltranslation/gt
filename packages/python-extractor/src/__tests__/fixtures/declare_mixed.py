from gt_flask import t, derive, declare_var

a = t(f"{derive('day' if x else 'night')} for {declare_var(name)}")
