from gt_flask import t, derive

def get_time():
    if is_morning():
        return "morning"
    else:
        return "evening"

a = t(f"It is {derive(get_time())}!")
