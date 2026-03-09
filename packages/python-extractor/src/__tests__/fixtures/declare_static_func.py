from gt_flask import t, declare_static

def get_time():
    if is_morning():
        return "morning"
    else:
        return "evening"

a = t(f"It is {declare_static(get_time())}!")
