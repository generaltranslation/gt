from gt_flask import t, derive

a = t(f"{derive('good' if x else 'bad')} {derive('day' if y else 'night')}")
