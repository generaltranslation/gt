from gt_flask import t, derive

def get_formality():
    if formal:
        return "formal"
    else:
        return "casual"

a = t(f"It is {derive('day' if is_day else 'night')}!", _context=derive(get_formality()))
