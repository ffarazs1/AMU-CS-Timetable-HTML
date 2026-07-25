# AMU Computer Science Timetable

A standalone, responsive timetable website built with:

- HTML5
- CSS3
- Vanilla JavaScript
- Bootstrap 5
- JSON

No React, Next.js, PHP, database, or build process is required.

## Project structure

```text
AMU-CS-Timetable-HTML/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
├── data/
│   └── timetable.json
└── vendor/
    └── bootstrap/
        ├── css/bootstrap.min.css
        └── js/bootstrap.bundle.min.js
```

## Run the website

The page reads `data/timetable.json` with JavaScript `fetch()`. Therefore, run
it through a local web server instead of double-clicking `index.html`.

### Option 1: VS Code Live Server

1. Open the extracted folder in VS Code.
2. Install the **Live Server** extension if needed.
3. Right-click `index.html`.
4. Select **Open with Live Server**.

### Option 2: Python local server

Open a terminal in the extracted folder and run:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Update the timetable

Edit only:

```text
data/timetable.json
```

After saving the JSON file, refresh the browser or press **Reload JSON** on the
webpage.

### Main JSON sections

- `metadata`: academic year, version, and effective date.
- `days`: ordered list of teaching days.
- `timeSlots`: period numbers and timings.
- `teachers`: mapping from teacher code to full name.
- `sessions`: complete schedule records.

### Session example

```json
{
  "id": "session-1",
  "day": "Monday",
  "programme": "MCA",
  "semester": 1,
  "classLabel": "MCA I",
  "startSlot": 3,
  "endSlot": 3,
  "course": "CAMS1004",
  "teachers": ["ARF", "FM"],
  "room": "LTU-2",
  "kind": "Lecture"
}
```

For a class spanning multiple periods, use different values for `startSlot`
and `endSlot`.

```json
{
  "startSlot": 5,
  "endSlot": 6
}
```

Optional explanatory text may be added through:

```json
{
  "note": "G-I: MUB/AS/11–13; G-II: ARF/FM/14–16"
}
```

## Available filters

- Programme
- Semester
- Class
- Teacher
- Classroom
- Day
- Period/time
- Session type
- Course code or keyword

The page also provides agenda and weekly-grid views, filtered CSV download, and
printing.

## Source-data note

`T1` and `T2` appear in the supplied MCA timetable sheets but are not defined
in their teacher legend. They are retained in the JSON as:

```json
"T1": "T1 — name not listed in source",
"T2": "T2 — name not listed in source"
```

Replace these values when the correct names are available.
