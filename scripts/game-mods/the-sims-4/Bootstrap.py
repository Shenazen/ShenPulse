try:
    import shenpulse_sims
except Exception:
    import os, tempfile, traceback
    with open(os.path.join(tempfile.gettempdir(), 'ShenPulseSims4-load.log'), 'a', encoding='utf8') as log:
        log.write(traceback.format_exc())
