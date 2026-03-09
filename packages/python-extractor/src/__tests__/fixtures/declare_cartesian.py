from gt_flask import t, declare_static

a = t(f"{declare_static('good' if x else 'bad')} {declare_static('day' if y else 'night')}")
