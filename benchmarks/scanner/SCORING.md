# Scanner benchmark release interpretation

A benchmark report is evidence only for the dataset and device configuration named in that report.

Release decisions should use the following hierarchy:

1. **CI smoke**: verifies the scorer, thresholds, report generation, and privacy/integrity fail-closed behavior.
2. **Real-device baseline**: establishes current Print-cess performance on a documented phone/OS/browser matrix.
3. **Regression comparison**: compares a candidate against the previous accepted baseline using the same corpus and device class.
4. **External-product comparison**: may be stated only when Print-cess and the comparator were tested on the same physical documents, device class, lighting setup, and scoring method.

Do not convert a synthetic CI pass into a marketing claim. Do not compare scores collected under different corpora or conditions as if they were directly equivalent.

For scanner changes that materially affect detection, crop correction, quality gating, OCR, PDF generation, or image processing, the preferred release evidence is:

- no failed default quality gate,
- no privacy/integrity violation,
- no statistically obvious regression in edge IoU, OCR error rate, or auto-capture precision/recall,
- processing latency and PDF size within the configured ceilings,
- manual inspection of representative failures rather than hiding them in aggregate averages.
