import { LightningElement, track, wire } from 'lwc';
import getInitialData from '@salesforce/apex/GradesController.getInitialData';
import getGradesData from '@salesforce/apex/GradesController.getGradesData';
import getStudentExams from '@salesforce/apex/GradesController.getStudentExams';


const SCOL = {
    Telugu: ["#58a6ff", "rgba(88,166,255,0.12)"],
    English: ["#3fb950", "rgba(63,185,80,0.12)"],
    Hindi: ["#f78166", "rgba(247,129,102,0.12)"],
    Maths: ["#d2a8ff", "rgba(210,168,255,0.12)"],
    Science: ["#ffa657", "rgba(255,166,87,0.12)"],
    Social: ["#79c0ff", "rgba(121,192,255,0.12)"]
};
const AVS = [
    ["#58a6ff", "rgba(88,166,255,0.15)"], ["#3fb950", "rgba(63,185,80,0.15)"],
    ["#d2a8ff", "rgba(210,168,255,0.15)"], ["#ffa657", "rgba(255,166,87,0.15)"],
    ["#f78166", "rgba(247,129,102,0.15)"], ["#79c0ff", "rgba(121,192,255,0.15)"]
];

export default class GradesModule extends LightningElement {
    @track testOptions = [];
    @track subjectOptions = [];
    @track students = [];

    @track searchTerm = '';
    @track selectedClass = '';
    @track selectedSection = '';
    @track selectedTest = '';
    @track selectedSubject = '';

    totalStudents = 0;
    classAverage = 0;
    averageDiff = 0;
    totalPassed = 0;
    totalFailed = 0;
    topScore = 0;
    passRate = 0;
    @track _topScorers = [];

    @track isModalOpen = false;
    @track modalStudent = {};
    @track modalMarks = [];
    @track testOptionsMeta = [];
    modalTestIndex = 0;
    modalExams = [];

    @track classOptions = [];
    @track sectionOptions = [];
    @track subjectMeta = [];

    @track totObt = 0;
    @track totMax = 0;
    @track subjectsPassed = 0;

    _rawGrades = null;
    _initialLoaded = false;

    @wire(getInitialData)
    wiredInitial({ error, data }) {
        if (data) {
            this.testOptions = data.testTypes || [];
            this.classOptions = data.classOptions || [];
            this.sectionOptions = data.sectionOptions || [];
            this.subjectMeta = data.subjects || [];
            this.subjectOptions = this.subjectMeta.map(s => s.label);
            this._initialLoaded = true;
            if (this._rawGrades) {
                this.processStudents(this._rawGrades);
            }
        } else if (error) {
            console.error('Initial data error:', error);
        }
    }

    @wire(getGradesData, {
        className: '$selectedClass',
        sectionName: '$selectedSection',
        examType: '$selectedTest',
        searchTerm: '$searchTerm'
    })
    wiredGrades({ error, data }) {
        if (data) {
            this._rawGrades = data;
            if (this._initialLoaded) {
                this.processStudents(data);
            }
        } else if (error) {
            console.error('Error fetching grades:', JSON.stringify(error));
        }
    }

    processStudents(data) {
        const selectedSubMeta = this.subjectMeta.find(s => s.label === this.selectedSubject);
        const subField = selectedSubMeta ? selectedSubMeta.field : null;

        let processed = data.map((exam, index) => {
            const initials = exam.Name
                ? exam.Name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                : '??';
            const av = AVS[index % AVS.length];

            let totalSum = 0;
            let count = 0;
            let subjectScore = 0;

            this.subjectMeta.forEach(sub => {
                const field = sub.field;
                let val = exam[field];
                if (typeof val === 'string') val = parseFloat(val) || 0;
                if (val !== undefined && val !== null) {
                    totalSum += val;
                    count++;
                    if (field === subField) {
                        subjectScore = val;
                    }
                }
            });

            let avg = count > 0 ? Math.round(totalSum / count) : 0;
            let displayScore = this.selectedSubject ? subjectScore : avg;

            return {
                ...exam,
                initials,
                avatarVars: `--av-bg:${av[1]}; --av-col:${av[0]}`,
                displayScore,
                totalSum,
                subjectScore,
                barStyle: `--bar-w:${displayScore}%`,
                grade: this.getGrade(displayScore),
                gradeBadgeClass: `badge ${this.getGradeClass(displayScore)}`,
                highlightedName: this.highlightText(exam.Name, this.searchTerm),
                highlightedRoll: this.highlightText(exam.Roll_No__c || '', this.searchTerm)
            };
        });

        this.students = processed;
        this.updateStats();
    }

    getScoreColor(s) {
        if (s >= 80) return 'var(--accent2)';
        if (s >= 70) return 'var(--accent)';
        if (s >= 60) return '#d2a8ff';
        return 'var(--accent3)';
    }

    getGrade(s) {
        if (s >= 90) return 'A+';
        if (s >= 80) return 'A';
        if (s >= 70) return 'B';
        if (s >= 60) return 'C';
        return 'D';
    }

    getGradeClass(s) {
        if (s >= 80) return 'gA';
        if (s >= 70) return 'gB';
        if (s >= 60) return 'gC';
        return 'gD';
    }

    highlightText(text, q) {
        if (!q || !text) return text;
        const i = text.toLowerCase().indexOf(q.toLowerCase());
        if (i < 0) return text;
        return (
            text.slice(0, i) +
            `<span class="hl">${text.slice(i, i + q.length)}</span>` +
            text.slice(i + q.length)
        );
    }

    updateStats() {
        const total = this.students.length;
        this.totalStudents = total;

        let passCount = 0;
        let failCount = 0;
        let sum = 0;

        this.students.forEach(s => {
            sum += s.displayScore;
            if (s.displayScore >= 35) passCount++;
            else failCount++;
        });

        let eligibleTopScorers = this.students
            .filter(s => s.displayScore >= 95)
            .sort((a, b) => b.displayScore - a.displayScore)
            .slice(0, 5);

        this.totalPassed = passCount;
        this.totalFailed = failCount;
        this.classAverage = total > 0 ? (sum / total).toFixed(1) : 0;
        this.topScore = eligibleTopScorers.length > 0 ? eligibleTopScorers[0].displayScore : 0;
        this._topScorers = eligibleTopScorers;
        this.passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;
        this.averageDiff = 0;
    }

    // HANDLERS
    handleSearch(event) { this.searchTerm = event.target.value; }
    handleClassChange(event) { this.selectedClass = event.target.value; }
    handleSectionChange(event) { this.selectedSection = event.target.value; }
    handleTestChange(event) { this.selectedTest = event.target.value; }

    handleSubjectChange(event) {
        this.selectedSubject = event.target.value;
        if (this._rawGrades) this.processStudents(this._rawGrades);
    }

    resetFilters() {
        this.searchTerm = '';
        this.selectedClass = '';
        this.selectedSection = '';
        this.selectedTest = '';
        this.selectedSubject = '';
        this.template.querySelectorAll('select').forEach(s => { s.value = ''; });
        this.template.querySelectorAll('input').forEach(i => { i.value = ''; });
        if (this._rawGrades) this.processStudents(this._rawGrades);
    }

    // MODAL
    openModal(event) {
        const examId = event.currentTarget.dataset.id;
        const preferredTest = event.currentTarget.dataset.test || null;
        const exam = this.students.find(s => s.Id === examId);

        if (!exam) return;

        this.modalStudent = exam;
        this.isModalOpen = true;

        getStudentExams({ studentId: exam.StudentId || exam.Id })
            .then(results => {
                this.modalExams = Array.isArray(results) ? results : [];

                if (preferredTest) {
                    const idx = this.testOptions.indexOf(preferredTest);
                    this.modalTestIndex = idx >= 0 ? idx : 0;
                } else {
                    const idx = this.testOptions.indexOf(this.selectedTest);
                    this.modalTestIndex = idx >= 0 ? idx : 0;
                }
                this.renderModalBody();
            })
            .catch(error => {
                console.error('Error fetching student exams:', error);
                this.modalExams = [];
                this.renderModalBody();
            });
    }

    closeModal() { this.isModalOpen = false; }
    bgClose() { this.closeModal(); }
    preventClose(event) { event.stopPropagation(); }

    switchTab(event) {
        this.modalTestIndex = parseInt(event.target.dataset.index, 10);
        this.renderModalBody();
    }

    renderModalBody() {
        const selectedT = this.testOptions[this.modalTestIndex];

        this.testOptionsMeta = this.testOptions.map(t => ({
            label: t,
            className: `mtab ${t === selectedT ? 'active' : ''}`,
            active: t === selectedT
        }));

        const exams = this.modalExams || [];
        const exam = exams.find(e => e.Exam_Type__c === selectedT) || null;

        // ─── FIX: Build TWO lookup maps ─────────────────────────────────────────
        // Map 1: lowercase keys  (for case-insensitive fallback)
        // Map 2: original keys   (for exact-match first attempt)
        const examFieldMapLower = {};
        const examFieldMapOrig  = {};

        if (exam) {
            Object.keys(exam).forEach(k => {
                examFieldMapOrig[k]            = exam[k];
                examFieldMapLower[k.toLowerCase()] = exam[k];
            });

            console.log('[GradesModule] examFieldMapOrig keys:', JSON.stringify(Object.keys(examFieldMapOrig)));
            console.log('[GradesModule] subjectMeta fields:',   JSON.stringify(this.subjectMeta.map(s => s.field)));
        }

        let totObt = 0;
        let totMax = 0;
        let passed = 0;

        // ── Step 1: Standard subjects from subjectMeta ──────────────────────────
        const standardSubjects = this.subjectMeta.filter(s => {
            const fieldLower = (s.field || '').toLowerCase();
            const labelLower = (s.label || '').toLowerCase();
            return fieldLower !== 'extra_marks__c' && labelLower !== 'extra marks';
        });

        // ── Step 2: Extra subjects from Extra_Marks__c JSON ─────────────────────
        let extraSubjects = [];
        // Try original casing first, then lowercase fallback
        const rawExtra =
            examFieldMapOrig['Extra_Marks__c'] ||
            examFieldMapOrig['extra_marks__c'] ||
            examFieldMapLower['extra_marks__c'] ||
            null;

        if (rawExtra) {
            try {
                const extraObj = typeof rawExtra === 'string' ? JSON.parse(rawExtra) : rawExtra;
                Object.keys(extraObj).forEach(subjectName => {
                    const alreadyExists = standardSubjects.find(
                        s => s.label.toLowerCase() === subjectName.toLowerCase()
                    );
                    if (!alreadyExists) {
                        extraSubjects.push({
                            label: subjectName,
                            field: null,
                            isExtra: true,
                            extraValue: Number(extraObj[subjectName]) || 0
                        });
                    }
                });
            } catch (e) {
                console.error('Extra_Marks__c JSON parse error:', e);
            }
        }

        // ── Step 3: Combine both lists ───────────────────────────────────────────
        const subjectList = [...standardSubjects, ...extraSubjects];

        this.modalMarks = subjectList.map((subMeta, index) => {
            const subj = subMeta.label;
            let sc = 0;

            if (exam) {
                if (subMeta.isExtra) {
                    // Extra subject: value already parsed from JSON
                    sc = subMeta.extraValue || 0;

                } else if (subMeta.field) {
                    // ── FIX: multi-strategy field lookup ────────────────────────
                    // Strategy 1: exact match using original casing from subjectMeta
                    let rawVal = examFieldMapOrig[subMeta.field];

                    // Strategy 2: lowercase match
                    if (rawVal === undefined || rawVal === null) {
                        rawVal = examFieldMapLower[subMeta.field.toLowerCase()];
                    }

                    // Strategy 3: strip namespace prefix then match
                    // e.g. subjectMeta.field = "Hindi__c"
                    //      examFieldMap may have "ns__Hindi__c"  (namespaced)
                    if (rawVal === undefined || rawVal === null) {
                        const baseLower = subMeta.field.toLowerCase();
                        const matchedKey = Object.keys(examFieldMapOrig).find(k => {
                            const kl = k.toLowerCase();
                            // exact
                            if (kl === baseLower) return true;
                            // namespace-prefixed: ns__field__c
                            if (kl.endsWith('__' + baseLower)) return true;
                            // strip caller's namespace prefix
                            const kStripped = kl.replace(/^[a-z0-9]+__/, '');
                            return kStripped === baseLower;
                        });
                        if (matchedKey !== undefined) {
                            rawVal = examFieldMapOrig[matchedKey];
                        }
                    }

                    // Strategy 4: match by label similarity as last resort
                    // e.g. subjectMeta.label = "Hindi" → look for key containing "hindi"
                    if ((rawVal === undefined || rawVal === null) && subMeta.label) {
                        const labelLower = subMeta.label.toLowerCase();
                        const matchedKey = Object.keys(examFieldMapOrig).find(k => {
                            const kl = k.toLowerCase();
                            // key must look like a custom field (ends with __c)
                            // and contain the subject label
                            return kl.endsWith('__c') && kl.includes(labelLower);
                        });
                        if (matchedKey !== undefined) {
                            rawVal = examFieldMapOrig[matchedKey];
                            console.log(`[GradesModule] Strategy 4 matched "${subMeta.field}" → "${matchedKey}" for label "${subMeta.label}"`);
                        }
                    }

                    if (rawVal !== undefined && rawVal !== null) {
                        sc = typeof rawVal === 'string'
                            ? (parseFloat(rawVal) || 0)
                            : Number(rawVal);
                    }
                }
            }

            const mx = 100;
            const pct = Math.round((sc / mx) * 100);
            const [col] = SCOL[subj] || ["#8b949e", "rgba(139,148,158,0.12)"];

            totObt += sc;
            totMax += mx;
            if (pct >= 35) passed++;

            return {
                index: index + 1,
                subj,
                sc,
                mx,
                pct,
                valStyle: `--val-col:${col}`,
                pctStyle: `font-weight:600; --pct-col:${this.getScoreColor(pct)}`,
                grade: this.getGrade(pct),
                gradeClass: `badge ${this.getGradeClass(pct)}`,
                statusLabel: pct >= 35 ? '✓ Pass' : '✗ Fail',
                statusStyle: `font-size:12px;font-weight:600; --status-col:${pct >= 35 ? 'var(--accent)' : 'var(--accent3)'}`,
                rowClass: this.selectedSubject === subj ? 'highlighted' : ''
            };
        });

        this.totObt = totObt;
        this.totMax = totMax;
        this.subjectsPassed = passed;
    }

    renderedCallback() {
        this.template.querySelectorAll('[data-style]').forEach(el => {
            const style = el.getAttribute('data-style');
            if (el.getAttribute('style') !== style) {
                el.setAttribute('style', style);
            }
        });
    }

    // Computed getters
    get classSelectClass() { return `sw ${this.selectedClass ? 'active' : ''}`; }
    get sectionSelectClass() { return `sw ${this.selectedSection ? 'active' : ''}`; }
    get testSelectClass() { return `sw ${this.selectedTest ? 'active' : ''}`; }
    get subjectSelectClass() { return `sw ${this.selectedSubject ? 'active' : ''}`; }
    get selectedTestLabel() { return this.selectedTest || 'No Test Selected'; }
    get totalClasses() {
        const unique = new Set(this.students.map(s => s.Class__c).filter(Boolean));
        return unique.size;
    }
    get topScorersList() {
        if (!this._topScorers || this._topScorers.length === 0) {
            return [{ Id: null, Name: 'None' }];
        }
        return this._topScorers.map(s => ({
            Id: s.Id,
            Name: s.Name,
            examType: s.Exam_Type__c || ''
        }));
    }
    get topScorerClassLabel() {
        if (!this._topScorers || this._topScorers.length === 0) return '';
        const s = this._topScorers[0];
        return this._topScorers.length === 1
            ? `${s.Class__c || ''} ${s.Section__c || ''}`.trim()
            : `${this._topScorers.length} Students`;
    }
    get totalSubjectCount() { return this.subjectMeta ? this.subjectMeta.length : 0; }
    get modalOverallPct() {
        return this.totMax > 0 ? Math.round((this.totObt / this.totMax) * 100) : 0;
    }
    get modalOverallGrade() { return this.getGrade(this.modalOverallPct); }
    get topScoreDisplay() { return `${this.topScore}%`; }
}