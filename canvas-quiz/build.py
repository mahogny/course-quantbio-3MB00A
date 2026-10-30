#!/usr/bin/env python3
"""Build the Canvas bonus quizzes from canvas-quiz/private/questions-week*.yml.

Run from the repo root:   python3 canvas-quiz/build.py
First check the answers:  Rscript canvas-quiz/private/check.R

Writes, per week N:
  quiz/weekN.qmd                         public, unlisted page: questions only, NO answers
  canvas-quiz/private/weekN-qti.zip      QTI 1.2 (Canvas flavour) for
                                         Course settings -> Import course content -> QTI .zip
  canvas-quiz/private/weekN-answers.md   review copy with answers and sources

This script contains no answers itself; canvas-quiz/private/ is git-ignored and
must never be checked in (the repo is public).
"""
import html
import re
import zipfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
PRIV = ROOT / "canvas-quiz" / "private"
PUBLIC = ROOT / "quiz"


def para_html(text):
    """Plain stem text -> HTML: blank line = paragraph, newline = <br>, `x` = <code>."""
    out = []
    for p in re.split(r"\n\s*\n", text.strip()):
        p = html.escape(p)
        p = re.sub(r"`([^`]+)`", r"<code>\1</code>", p)
        out.append("<p>" + p.replace("\n", "<br>\n") + "</p>")
    return "\n".join(out)


def question_html(q):
    s = para_html(q["stem"])
    if q.get("r_snippet"):
        s += "\n<pre><code>" + html.escape(q["r_snippet"].rstrip()) + "</code></pre>"
    return s


def mattext(h):
    return f'<material><mattext texttype="text/html">{html.escape(h)}</mattext></material>'


def meta(qtype):
    return ("<itemmetadata><qtimetadata>"
            f"<qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>{qtype}</fieldentry></qtimetadatafield>"
            "<qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>1.0</fieldentry></qtimetadatafield>"
            "</qtimetadata></itemmetadata>")


def feedback(q):
    if not q.get("explanation"):
        return "", ""
    show = ('<respcondition continue="Yes"><conditionvar><other/></conditionvar>'
            '<displayfeedback feedbacktype="Response" linkrefid="general_fb"/></respcondition>')
    fb = (f'<itemfeedback ident="general_fb"><flow_mat>{mattext("<p>" + html.escape(q["explanation"]) + "</p>")}'
          "</flow_mat></itemfeedback>")
    return show, fb


def qti_item(q):
    show, fb = feedback(q)
    head = f'<item ident="{q["id"]}" title="{html.escape(q["title"])}">'
    score = '<setvar action="Set" varname="SCORE">100</setvar>'
    outcomes = '<outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>'
    if q["type"] == "numeric":
        a, m = float(q["answer"]), float(q["margin"])
        pres = ("<presentation>" + mattext(question_html(q)) +
                '<response_str ident="response1" rcardinality="Single">'
                '<render_fib fibtype="Decimal"><response_label ident="answer1"/></render_fib>'
                "</response_str></presentation>")
        cond = (f'<respcondition continue="No"><conditionvar><or>'
                f'<varequal respident="response1">{a}</varequal>'
                f'<and><vargte respident="response1">{a - m}</vargte><varlte respident="response1">{a + m}</varlte></and>'
                f"</or></conditionvar>{score}</respcondition>")
        return head + meta("numerical_question") + pres + "<resprocessing>" + outcomes + show + cond + "</resprocessing>" + fb + "</item>"
    # multiple choice
    ids = [f'{q["id"]}_{k + 1}' for k in range(len(q["choices"]))]
    labels = "".join(f'<response_label ident="{i}">{mattext(html.escape(c))}</response_label>'
                     for i, c in zip(ids, q["choices"]))
    pres = ("<presentation>" + mattext(question_html(q)) +
            f'<response_lid ident="response1" rcardinality="Single"><render_choice>{labels}</render_choice>'
            "</response_lid></presentation>")
    cond = (f'<respcondition continue="No"><conditionvar><varequal respident="response1">{ids[q["correct"] - 1]}</varequal>'
            f"</conditionvar>{score}</respcondition>")
    return head + meta("multiple_choice_question") + pres + "<resprocessing>" + outcomes + show + cond + "</resprocessing>" + fb + "</item>"


def write_qti(week, qs):
    qid = f"bonus_quiz_week{week}"
    title = f"Bonus quiz, week {week}"
    items = "\n".join(qti_item(q) for q in qs)
    assessment = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                  '<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" '
                  'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
                  'xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 '
                  'http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">\n'
                  f'<assessment ident="{qid}" title="{title}"><qtimetadata>'
                  "<qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>unlimited</fieldentry></qtimetadatafield>"
                  f'</qtimetadata><section ident="root_section">\n{items}\n</section></assessment></questestinterop>\n')
    desc = html.escape(f"<p>Bonus quiz for week {week}: {len(qs)} questions, 3 correct is a pass.</p>")
    meta_xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                f'<quiz identifier="{qid}" xmlns="http://canvas.instructure.com/xsd/cccv1p0" '
                'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
                'xsi:schemaLocation="http://canvas.instructure.com/xsd/cccv1p0 https://canvas.instructure.com/xsd/cccv1p0.xsd">'
                f"<title>{title}</title><description>{desc}</description>"
                "<shuffle_answers>true</shuffle_answers><scoring_policy>keep_highest</scoring_policy>"
                f"<quiz_type>assignment</quiz_type><points_possible>{float(len(qs))}</points_possible>"
                "<allowed_attempts>-1</allowed_attempts><one_question_at_a_time>false</one_question_at_a_time>"
                "<cant_go_back>false</cant_go_back><available>false</available></quiz>\n")
    manifest = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                f'<manifest identifier="{qid}_manifest" xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1">'
                "<metadata><schema>IMS Content</schema><schemaversion>1.1.3</schemaversion></metadata>"
                "<organizations/><resources>"
                f'<resource identifier="{qid}" type="imsqti_xmlv1p2"><file href="{qid}/{qid}.xml"/>'
                f'<dependency identifierref="{qid}_meta"/></resource>'
                f'<resource identifier="{qid}_meta" type="associatedcontent/imscc_xmlv1p1/learning-application-resource" '
                f'href="{qid}/assessment_meta.xml"><file href="{qid}/assessment_meta.xml"/></resource>'
                "</resources></manifest>\n")
    out = PRIV / f"week{week}-qti.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("imsmanifest.xml", manifest)
        z.writestr(f"{qid}/{qid}.xml", assessment)
        z.writestr(f"{qid}/assessment_meta.xml", meta_xml)
    return out


def md_stem(q):
    # keep the stem's line breaks on the page: a trailing backslash is a Markdown line break
    paras = re.split(r"\n\s*\n", q["stem"].strip())
    # "(a) ..." at the start of a line would become a Pandoc list: escape the bracket
    paras = [re.sub(r"(?m)^\((\w)\)", r"\\(\1)", p) for p in paras]
    return "\n\n".join(" \\\n".join(p.split("\n")) for p in paras)


def write_public(week, qs):
    lines = ["---", f'title: "Bonus quiz, week {week}: the questions"', "search: false", "---", "",
             "Answer these in **Canvas**. They are listed here so you can see them next to the course "
             "material. You may use pen and paper and R.", ""]
    for q in qs:
        lines += [f"## Question {q['n']}: {q['title']}", "", md_stem(q), ""]
        if q.get("r_snippet"):
            lines += ["```r", q["r_snippet"].rstrip(), "```", ""]
        if q["type"] == "mc":
            lines += [f"- **{chr(65 + k)}** {c}" for k, c in enumerate(q["choices"])] + [""]
    PUBLIC.mkdir(exist_ok=True)
    out = PUBLIC / f"week{week}.qmd"
    out.write_text("\n".join(lines))
    return out


def write_answers(week, qs):
    lines = [f"# Bonus quiz, week {week}: answers (PRIVATE, never check in)", ""]
    for q in qs:
        lines += [f"## {q['n']}. {q['title']}  ({q['id']}; units: {', '.join(q['units'])})", "",
                  f"Source: {q['source']}", "", md_stem(q), ""]
        if q.get("r_snippet"):
            lines += ["```r", q["r_snippet"].rstrip(), "```", ""]
        if q["type"] == "mc":
            lines += [f"- **{chr(65 + k)}** {c}{'   **← correct**' if k + 1 == q['correct'] else ''}"
                      for k, c in enumerate(q["choices"])] + [""]
        else:
            lines += [f"**Answer:** {q['answer']} ± {q['margin']}", ""]
        lines += [f"*Explanation:* {q.get('explanation', '')}", ""]
    out = PRIV / f"week{week}-answers.md"
    out.write_text("\n".join(lines))
    return out


def main():
    qs = [q for f in sorted(PRIV.glob("questions-week*.yml")) for q in (yaml.safe_load(f.read_text()) or [])]
    for week in sorted({q["week"] for q in qs}):
        wq = sorted((q for q in qs if q["week"] == week), key=lambda q: q["n"])
        for f in (write_public(week, wq), write_qti(week, wq), write_answers(week, wq)):
            print("wrote", f.relative_to(ROOT))


if __name__ == "__main__":
    main()
