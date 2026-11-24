# Training data for the free scam classifier

Each `.tsv` file has one example per line: `spam` or `ham`, a tab, then the message text.
`spam` means scam; `ham` means a normal message.

| File | What it is | Source and licence |
|---|---|---|
| `sms-spam-collection.tsv` | 5,574 English SMS messages (747 spam) collected in the UK around 2011 | UCI SMS Spam Collection, Almeida and Hidalgo. https://archive.ics.uci.edu/dataset/228/sms+spam+collection. Licence: CC BY 4.0 |
| `seed-uae.tsv` | About 100 short Arabic and English messages in the style of UAE scams and normal UAE messages | Written for this project. These are invented examples, not real messages |

## Website names (`urls/`)

| File | What it is | Source and licence |
|---|---|---|
| `urls/phiusiil-hosts.tsv` | 219,000 website names labelled `phish` or `legit`, without `www.` or paths | PhiUSIIL Phishing URL Dataset, Prasad and Chandra. https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset. Licence: CC BY 4.0. Rebuild with `node scripts/prepare-url-data.mjs <csv>` |
| `urls/phishing-database-hosts.tsv` | 150,000 phishing website names reported to Phishing.Database (snapshot 24 Nov 2026), without official brand domains, shared hosting sites or anything used for evaluation | Phishing.Database, MIT licence. Rebuild with `node scripts/prepare-phishdb-data.mjs` after the server has downloaded the list |
| `urls/seed-uae-hosts.tsv` | About 120 real UAE and well-known genuine sites, and invented UAE look-alike scam names | Written for this project. The `phish` names are invented, not real reported sites |

Retrain with `npm run train:urls`. Add real reported scam website names to a new `.tsv` in `urls/` (they count 50 times as much as the public set).

`eval/uae-legit-hosts.txt` lists real UAE websites used only to measure false alarms (`npm run evaluate`).

`feeds/` is the downloaded copy of the phishing lists (not part of the project; refreshed by the server).

## Adding real examples

Real reported messages are what will make the model accurate for the UAE.

1. Remove names, phone numbers, account and card numbers, Emirates ID numbers and codes.
2. Save them in a new file here, for example `reported-2026.tsv`, in the same format.
3. Run `npm run train`, then restart the server.

Every file except the public UCI set counts 20 times as much in training, because local examples are fewer but closer to what people submit. `npm run train` prints the model's accuracy on examples it didn't train on. Check that number before replacing the model.
