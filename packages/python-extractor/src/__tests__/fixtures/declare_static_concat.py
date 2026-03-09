from gt_flask import t, declare_static

def get_time():
    if is_morning():
        return "morning"
    else:
        return "evening"

a = t("Hello " + declare_static("day" if x else "night") + "!")
