from gt_flask import t, derive

def get_time():
    if is_morning():
        return "morning"
    else:
        return "evening"

a = t("Hello " + derive("day" if x else "night") + "!")
