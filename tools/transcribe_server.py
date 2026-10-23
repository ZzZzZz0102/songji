# -*- coding: utf-8 -*-
"""常驻语音转写服务：从 stdin 逐行读取音频路径，转写中文后将 JSON 输出到 stdout。
模型首次启动加载一次，之后常驻复用。"""
import sys
import json

CORRECTIONS = [
    # 松溉古镇（地名，whisper 常听成同音/近音字）
    ('松剂', '松溉'), ('松寄', '松溉'), ('松季', '松溉'), ('松基', '松溉'),
    ('松集', '松溉'), ('松几', '松溉'), ('松际', '松溉'), ('松系', '松溉'),
    ('宋剂', '松溉'), ('宋寄', '松溉'), ('宋季', '松溉'), ('松溪', '松溉'),
    ('松级', '松溉'), ('松技', '松溉'), ('松记', '松溉'),
    # 高频专有名词
    ('油子伞', '油纸伞'), ('油脂伞', '油纸伞'), ('油纸扇', '油纸伞'),
    ('古县崖', '古县衙'), ('古现衙', '古县衙'), ('古线衙', '古县衙'),
    ('罗家瓷堂', '罗家祠堂'), ('罗家词堂', '罗家祠堂'), ('罗佳祠堂', '罗家祠堂'),
    ('猪儿巴', '猪儿粑'), ('猪儿芭', '猪儿粑'),
    ('酒大碗', '九大碗'), ('临江茶管', '临江茶馆'), ('茶管', '茶馆'),
]

def correct(text):
    for old, new in CORRECTIONS:
        text = text.replace(old, new)
    return text

def main():
    from faster_whisper import WhisperModel
    model = WhisperModel('small', device='cpu', compute_type='int8')
    hint = '松溉古镇，罗家祠堂，古县衙，油纸伞体验馆，九大碗，猪儿粑，临江茶馆，永川区，长江。'
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            segments, _info = model.transcribe(line, language='zh', task='transcribe', initial_prompt=hint)
            text = correct(''.join(s.text for s in segments).strip())
            sys.stdout.write(json.dumps({'text': text}, ensure_ascii=False) + '\n')
        except Exception as exc:
            sys.stdout.write(json.dumps({'error': str(exc)}, ensure_ascii=False) + '\n')
        sys.stdout.flush()

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        sys.stderr.write('transcribe_server fatal: %s\n' % exc)
        sys.exit(1)
