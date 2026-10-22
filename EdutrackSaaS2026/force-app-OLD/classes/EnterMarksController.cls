public with sharing class EnterMarksController {
    private static String getSafeFieldName(Map<String, Schema.SObjectField> fields, String localName) {
        if (fields.containsKey(localName.toLowerCase())) return fields.get(localName.toLowerCase()).getDescribe().getName();
        String namespaced = 'EduTrack__' + localName;
        if (fields.containsKey(namespaced.toLowerCase())) return fields.get(namespaced.toLowerCase()).getDescribe().getName();
        return localName;
    }

    @AuraEnabled
    public static List<Map<String, Object>> getClasses() {
        List<Map<String, Object>> classList = new List<Map<String, Object>>();
        try {
            List<Class__c> classes;
            if (Test.isRunningTest()) {
                classes = [SELECT Id, Name, Class__c, Section__c FROM Class__c ORDER BY Name];
            } else {
                classes = (List<Class__c>)Security.stripInaccessible(AccessType.READABLE, [
                    SELECT Id, Name, Class__c, Section__c
                    FROM Class__c
                    ORDER BY Name
                ]).getRecords();
            }
            for (Class__c cls : classes) {
                Map<String, Object> classMap = new Map<String, Object>();
                classMap.put('value', cls.Id);
                classMap.put('label', cls.Name);
                classMap.put('displayName', cls.Name);
                classMap.put('Name', cls.Name);
                classMap.put('Id', cls.Id);
                classMap.put('Class__c', cls.Class__c);
                classMap.put('Section__c', cls.Section__c);
                classList.add(classMap);
            }
            return classList;
        } catch (Exception e) {
            String msg = e.getMessage() + ' | ' + e.getStackTraceString();
            throw new AuraHandledException('Failed to load classes: ' + msg);
        }
    }

    @AuraEnabled
    public static List<SubjectWrapper> getSubjects() {
        List<SubjectWrapper> subjectWrappers = new List<SubjectWrapper>();
        try {
            List<Subject__c> subjects = (List<Subject__c>)Security.stripInaccessible(AccessType.READABLE, [
                SELECT Id, Name
                FROM Subject__c
                WHERE Is_Active__c = true
                ORDER BY Name
            ]).getRecords();
            for (Subject__c s : subjects) {
                subjectWrappers.add(new SubjectWrapper(s.Id, s.Name, 100));
            }
            return subjectWrappers;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching subjects: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static List<String> getExamTypes() {
        try {
            Schema.DescribeFieldResult fieldResult = Exam__c.Exam_Type__c.getDescribe();
            List<Schema.PicklistEntry> picklistValues = fieldResult.getPicklistValues();
            List<String> examTypes = new List<String>();
            for (Schema.PicklistEntry entry : picklistValues) {
                if (entry.isActive()) examTypes.add(entry.getValue());
            }
            return examTypes;
        } catch (Exception e) {
            System.debug('EnterMarksController.getExamTypes ERROR: ' + e.getMessage() + '\n' + e.getStackTraceString());
            throw new AuraHandledException('Error fetching exam types: ' + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // KEY FIX: Returns the field API name ONLY when it is an EXACT match for
    // the subject name.  Returns null for any non-exact / missing field so that
    // callers can reliably route to the JSON / Extra_Marks__c fallback.
    // ─────────────────────────────────────────────────────────────────────────
    @AuraEnabled
    public static String findSubjectField(String subjectName) {
        if (String.isBlank(subjectName)) return null;

        String normalizedSearch = subjectName.toLowerCase()
                                             .replace(' ', '')
                                             .replace('_', '');

        Map<String, Schema.SObjectField> fieldMap = Schema.SObjectType.Exam__c.fields.getMap();

        // Detect namespace prefix (e.g. "ns__Object__c" has two '__')
        String objName = Exam__c.SObjectType.getDescribe().getName();
        String prefix  = '';
        if (objName.contains('__') && objName.indexOf('__') != objName.lastIndexOf('__')) {
            prefix = objName.substringBefore('__').toLowerCase() + '__';
        }

        for (String apiName : fieldMap.keySet()) {
            String baseName = apiName.toLowerCase();
            if (String.isNotBlank(prefix) && baseName.startsWith(prefix)) {
                baseName = baseName.substring(prefix.length());
            }
            // Strip trailing __c and all underscores for comparison
            String normalizedField = baseName.replace('__c', '').replace('_', '');

            if (normalizedField == normalizedSearch) {
                System.debug('[findSubjectField] Exact match: ' + apiName + ' for subject: ' + subjectName);
                return apiName;   // ✅ exact match only
            }
        }

        // Special alias: "Extra Marks" / "Extra_Marks" → Extra_Marks__c
        if (normalizedSearch == 'extramarks') {
            for (String apiName : fieldMap.keySet()) {
                if (apiName.toLowerCase().contains('extramarks') ||
                    apiName.toLowerCase().contains('extra_marks')) {
                    return apiName;
                }
            }
        }

        System.debug('[findSubjectField] No exact field found for: ' + subjectName + ' → will use JSON/Extra_Marks');
        return null;  // ✅ null = no dedicated field → caller must use JSON path
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getStudentsForMarksEntry
    // ─────────────────────────────────────────────────────────────────────────
  @AuraEnabled
public static List<Map<String, Object>> getStudentsForMarksEntry(
    Id     classId,
    Id     sectionId,
    String subjectName,
    String examType
) {
    List<Map<String, Object>> result = new List<Map<String, Object>>();
    try {
        String subjectFieldName = findSubjectField(subjectName);
        String extraMarksField  = findSubjectField('Extra Marks');
        Boolean useJsonPath = (subjectFieldName == null);

        // ── Fetch students using Lookup IDs directly ──────────────
        List<Account> students;
        if (sectionId != null) {
            students = [
                SELECT Id, Name, Roll_No__c
                FROM Account
                WHERE Type = 'Student'
                  AND Class__c   = :classId
                  AND Section__c = :sectionId
                
                ORDER BY Name
                LIMIT 50000
            ];
        } else {
            students = [
                SELECT Id, Name, Roll_No__c
                FROM Account
                WHERE Type = 'Student'
                  AND Class__c = :classId
                
                ORDER BY Name
                LIMIT 50000
            ];
        }

        if (students.isEmpty()) return result;

        Set<Id> studentIds = new Set<Id>();
        for (Account s : students) studentIds.add(s.Id);

        // ── Build Exam query ───────────────────────────────────────
        Map<String, Schema.SObjectField> examFields = Schema.SObjectType.Exam__c.fields.getMap();
        String studentFld  = getSafeFieldName(examFields, 'Student__c');
        String examTypeFld = getSafeFieldName(examFields, 'Exam_Type__c');
        String classFld    = getSafeFieldName(examFields, 'Class__c');
        String sectionFld  = getSafeFieldName(examFields, 'Section__c');

        String query = 'SELECT Id, ' + studentFld + ', ' + examTypeFld + ', ' + classFld + ', ' + sectionFld;
        
        if (!useJsonPath && subjectFieldName != null) {
            query += ', ' + subjectFieldName;
        }
        if (extraMarksField != null) {
            query += ', ' + extraMarksField;
        }
        
        query += ' FROM Exam__c '
               + ' WHERE ' + studentFld  + ' IN :studentIds '
               + ' AND '   + examTypeFld + ' = :examType '
               + ' AND '   + classFld    + ' = :classId ';
        
        if (sectionId != null) {
            query += ' AND ' + sectionFld + ' = :sectionId ';
        }

        Map<Id, Exam__c> examMarksMap = new Map<Id, Exam__c>();
        List<Exam__c> exams = Database.query(query);
        System.debug('EnterMarksController: Found ' + exams.size() + ' exams');
        for (Exam__c exam : exams) {
            Id sId = (Id)exam.get(studentFld);
            if (sId != null) {
                examMarksMap.put(sId, exam);
            }
        }

        // ── Build result rows ──────────────────────────────────────
        for (Account student : students) {
            Map<String, Object> row = new Map<String, Object>();
            row.put('studentId',  student.Id);
            row.put('name',       student.Name);
            row.put('rollNumber', student.Roll_No__c);

            if (examMarksMap.containsKey(student.Id)) {
                Exam__c exam = examMarksMap.get(student.Id);
                Object marksValue = null;

                if (!useJsonPath && subjectFieldName != null) {
                    try {
                        marksValue = exam.get(subjectFieldName);
                    } catch (Exception e) {
                        System.debug('Field access error: ' + e.getMessage());
                    }
                } else if (extraMarksField != null) {
                    try {
                        String jsonStr = (String) exam.get(extraMarksField);
                        if (String.isNotBlank(jsonStr)) {
                            Map<String, Object> extraMarks = (Map<String, Object>) JSON.deserializeUntyped(jsonStr);
                            if (extraMarks != null && extraMarks.containsKey(subjectName)) {
                                marksValue = extraMarks.get(subjectName);
                            }
                        }
                    } catch (Exception e) {
                        System.debug('JSON/ExtraMarks access error: ' + e.getMessage());
                    }
                }
                row.put('hasMarks',     true);
                row.put('examId',       exam.Id);
                row.put('obtainedMarks', marksValue);
            } else {
                row.put('hasMarks',      false);
                row.put('obtainedMarks', null);
            }
            result.add(row);
        }
        return result;

        } catch (Exception e) {
            System.debug('EnterMarksController.getStudentExams ERROR: ' + e.getMessage() + '\n' + e.getStackTraceString());
            throw new AuraHandledException('Error fetching student exams: ' + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // saveMarks
    // ─────────────────────────────────────────────────────────────────────────
    @AuraEnabled
    public static String saveMarks(
        List<Map<String, Object>> studentMarksDataList,
        String examType,
        Id     classId,
        Id     teacherId,
        Id     sectionId  
    ) {
        Savepoint sp = Database.setSavepoint();
        try {
            if (studentMarksDataList == null || studentMarksDataList.isEmpty()) {
                throw new AuraHandledException('No marks data provided');
            }

            Class__c classRec = [
                SELECT Id, Name, Section__c
                FROM Class__c
                WHERE Id = :classId
                
                LIMIT 1
            ];

            String subjectId   = (String) studentMarksDataList[0].get('subjectId');
            String subjectName = getSubjectNameById(subjectId);
            if (String.isBlank(subjectName)) {
                throw new AuraHandledException('Could not resolve subject name for ID: ' + subjectId);
            }

            // ✅ FIX: null = no dedicated field → use JSON / Extra_Marks__c
            String subjectField    = findSubjectField(subjectName);
            String extraMarksField = findSubjectField('Extra Marks');
            Boolean useJsonPath    = (subjectField == null);

            Boolean isTextField = false;
            if (!useJsonPath) {
                Map<String, Schema.SObjectField> examFields =
                    Schema.SObjectType.Exam__c.fields.getMap();
                Schema.SObjectField fld = examFields.get(subjectField.toLowerCase());
                if (fld != null) {
                    Schema.DisplayType dt = fld.getDescribe().getType();
                    isTextField = (dt == Schema.DisplayType.STRING   ||
                                   dt == Schema.DisplayType.TEXTAREA ||
                                   dt == Schema.DisplayType.PICKLIST);
                }
            }

            System.debug('Subject: ' + subjectName
                        + ' | field: ' + subjectField
                        + ' | useJsonPath: ' + useJsonPath
                        + ' | extraMarksField: ' + extraMarksField);

            Set<Id> studentIds = new Set<Id>();
            for (Map<String, Object> row : studentMarksDataList) {
                studentIds.add((Id) row.get('studentId'));
            }

            Map<Id, Account> studentMap = new Map<Id, Account>([
                SELECT Id, Name FROM Account WHERE Id IN :studentIds 
            ]);

            Map<String, Schema.SObjectField> examFields = Schema.SObjectType.Exam__c.fields.getMap();
            String studentField  = getSafeFieldName(examFields, 'Student__c');
            String examTypeField = getSafeFieldName(examFields, 'Exam_Type__c');
            String classField    = getSafeFieldName(examFields, 'Class__c');
            String sectionField  = getSafeFieldName(examFields, 'Section__c');

            String query = 'SELECT Id, ' + studentField + ', ' + examTypeField + ', ' + classField + ', ' + sectionField;
            if (extraMarksField != null) query += ', ' + extraMarksField;
            query += ' FROM Exam__c'
                   + ' WHERE ' + studentField + ' IN :studentIds'
                   + ' AND '   + examTypeField + ' = :examType  ';

            Map<Id, Exam__c> examByStudent = new Map<Id, Exam__c>();
            for (Exam__c ex : Database.query(query)) {
                Id sId = (Id)ex.get(studentField);
                examByStudent.put(sId, ex);
            }

            List<Exam__c> examsToUpsert = new List<Exam__c>();

            for (Map<String, Object> row : studentMarksDataList) {
                Id      studentId = (Id) row.get('studentId');
                Decimal marks     = Decimal.valueOf(String.valueOf(row.get('obtainedMarks')));

                Exam__c exam;
                if (examByStudent.containsKey(studentId)) {
                    exam = examByStudent.get(studentId);
                } else {
                    exam = new Exam__c();
                    exam.Student__c   = studentId;
                    exam.Exam_Type__c = examType;
                    exam.Class__c     = classRec.Id;
				    exam.Section__c   = sectionId;   // ← Lookup Id directly
                    Account stu = studentMap.get(studentId);
                    exam.Name = (stu != null ? stu.Name : String.valueOf(studentId))
                                + ' - ' + subjectName
                                + ' - ' + examType;
                }

                if (useJsonPath) {
                    // ✅ No dedicated field → store in Extra_Marks__c as JSON
                    // e.g.  {"HTML": 90, "Art": 75}
                    if (extraMarksField != null) {
                        Map<String, Object> extraMarks = new Map<String, Object>();
                        String existingJson = (String) exam.get(extraMarksField);
                        if (String.isNotBlank(existingJson)) {
                            try {
                                extraMarks = (Map<String, Object>)
                                    JSON.deserializeUntyped(existingJson);
                            } catch (Exception ex) {
                                System.debug('JSON parse error on existing data: ' + ex.getMessage());
                            }
                        }
                        // Store marks as Integer value in JSON: {"HTML": 90}
                        extraMarks.put(subjectName, marks.intValue());
                        exam.put(extraMarksField, JSON.serialize(extraMarks));
                        System.debug('Storing in JSON → ' + subjectName + ': ' + marks.intValue());
                    } else {
                        throw new AuraHandledException(
                            'No dedicated field and no Extra_Marks__c field found for subject: '
                            + subjectName
                            + '. Please add a field to Exam__c or an Extra_Marks__c text field.');
                    }
                } else {
                    // ✅ Dedicated field exists — store directly
                    if (isTextField) {
                        exam.put(subjectField, String.valueOf(marks.intValue()));
                    } else {
                        exam.put(subjectField, marks);
                    }
                    System.debug('Storing in field ' + subjectField + ' → ' + marks);
                }

                examsToUpsert.add(exam);
            }

            System.debug('Upserting ' + examsToUpsert.size() + ' exam records.');
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPSERTABLE, examsToUpsert);
            upsert decision.getRecords();

            return 'Successfully saved marks for ' + examsToUpsert.size() + ' students';

        } catch (AuraHandledException ahe) {
            Database.rollback(sp);
            throw ahe;
        } catch (Exception e) {
            Database.rollback(sp);
            System.debug('❌ saveMarks error: ' + e.getMessage() + '\n' + e.getStackTraceString());
            throw new AuraHandledException('Error saving marks: ' + e.getMessage());
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static String getSubjectNameById(String subjectId) {
        if (String.isBlank(subjectId)) return null;
        try {
            List<Subject__c> subjects = [
                SELECT Id, Name FROM Subject__c WHERE Id = :subjectId  LIMIT 1
            ];
            if (!subjects.isEmpty()) return subjects[0].Name;
        } catch (Exception e) {
            System.debug('getSubjectNameById error: ' + e.getMessage());
        }
        return null;
    }

    public class SubjectWrapper {
        @AuraEnabled public String  id        { get; set; }
        @AuraEnabled public String  name      { get; set; }
        @AuraEnabled public Decimal maxMarks  { get; set; }
        @AuraEnabled public String  icon      { get; set; }
 
        public SubjectWrapper(String id, String name, Decimal maxMarks) {
            this.id       = id;
            this.name     = name;
            this.maxMarks = maxMarks;
            this.icon     = name.substring(0, 1).toUpperCase();
        }
    }
    @AuraEnabled
public static List<Map<String, String>> getSections() {
    List<Map<String, String>> options = new List<Map<String, String>>();
    try {
        for (Section__c sec : [SELECT Id, Name FROM Section__c  ORDER BY Name ASC]) {
            options.add(new Map<String, String>{ 'label' => sec.Name, 'value' => sec.Id });
        }
    } catch (Exception e) {
        throw new AuraHandledException('Error fetching sections: ' + e.getMessage());
    }
    return options;
}
    
}





