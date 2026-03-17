from gt_flask import t, declare_static, declare_var

a = t(f"{declare_static('day' if x else 'night')} for {declare_var(name)}")
