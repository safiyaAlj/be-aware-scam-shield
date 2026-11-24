# Link checker evaluation

Measured on 2026-11-24 with `npm run evaluate` (scripts/evaluate-links.mjs). Nothing in these test sets was used for training.

**Test data**
- Phishing: 111 live phishing addresses from the OpenPhish community feed (downloaded 2026-11-24); 189 more were skipped because their website name is in the training data.
- Genuine: 64 real UAE websites from `data/eval/uae-legit-hosts.txt` (government, banks, telecoms, airlines, shops, news, universities, hospitals); 57 skipped because they are in the training data.

**Results without the phishing lists** (a brand-new scam site nobody has reported yet; no internet lookups)

| | Website-name model alone (≥ 70%) | Full check: rules + model |
|---|---|---|
| Phishing sites caught | 61 / 111 (55.0%) | 62 / 111 (55.9%) |
| Genuine UAE sites wrongly flagged | 0 / 64 (0.0%) | 0 / 64 (0.0%) |

"Flagged" for the full check means a result of *suspicious* or *likely scam*. With the phishing lists switched on, every address in a list is caught as well; the lists cover reported sites, the rules and model cover new ones.

**Speed:** 0.42 ms per link on average (one CPU core, no network).

**Genuine sites wrongly flagged by the full check**
- none

**Examples of phishing addresses it missed** (first 10)
- `http://readeach.com/Jgsxw`
- `http://spi14.com/`
- `http://s0y17.com/`
- `https://155aes.senes.at/mining?b=yto0ontzoju6imxhymvsijtzoja6iii7czozoij1c3iio2k6mty5ottzojq6im5vcgqio3m6mtq6injzcziuc2f5bgvylmf0ijtzoje6im8io2k6mte1ntt9`
- `https://ueya.mx/tress/4`
- `http://member121.metaagencynetwork.com/`
- `https://winonapainting.com/wp-admin/drive-index.html?eta=veror8@f10318b13ef8feded2f1c699b5a30004a8f7.org`
- `https://abuzzoxfordcapssimla.hostel.town/`
- `https://midasbuy.zh.kg/`
- `https://spectrum.americanfashionnetwork.com/`
