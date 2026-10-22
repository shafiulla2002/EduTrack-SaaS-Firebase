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
            classes = (List<Class__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name, Class__c, Section__c FROM Class__c ORDER BY Name LIMIT 1000]).getRecords();
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
            List<Subject__c> subjects = (List<Subject__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name FROM Subject__c WHERE Is_Active__c = true ORDER BY Name LIMIT 1000]).getRecords();
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
            throw new AuraHandledException('Error fetching exam types: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static String findSubjectField(String subjectName) {
        if (String.isBlank(subjectName)) return null;

        String normalizedSearch = subjectName.toLowerCase()
                                             .replace(' ', '')
                                             .replace('_', '');

        Map<String, Schema.SObjectField> fieldMap = Schema.SObjectType.Exam__c.fields.getMap();

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
            String normalizedField = baseName.replace('__c', '').replace('_', '');

            if (normalizedField == normalizedSearch) {
                return apiName;
            }
        }

        if (normalizedSearch == 'extramarks') {
            for (String apiName : fieldMap.keySet()) {
                if (apiName.toLowerCase().contains('extramarks') ||
                    apiName.toLowerCase().contains('extra_marks')) {
                    return apiName;
                }
            }
        }

        return null;
    }

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

        List<Account> students;
        if (sectionId != null) {
            students = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name, Roll_No__c FROM Account WHERE Type = 'Student' AND Class__c = :classId AND Section__c = :sectionId ORDER BY Name LIMIT 1000]).getRecords();
        } else {
            students = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name, Roll_No__c FROM Account WHERE Type = 'Student' AND Class__c = :classId ORDER BY Name LIMIT 1000]).getRecords();
        }

        if (students.isEmpty()) return result;

        Set<Id> studentIds = new Set<Id>();
        for (Account s : students) studentIds.add(s.Id);
        Map<Id, Exam__c> examMarksMap = new Map<Id, Exam__c>();

        Map<String, Schema.SObjectField> examFields = Schema.SObjectType.Exam__c.fields.getMap();
        String studentFld  = getSafeFieldName(examFields, 'Student__c');
        String examTypeFld = getSafeFieldName(examFields, 'Exam_Type__c');
        String classFld    = getSafeFieldName(examFields, 'Class__c');
        String sectionFld  = getSafeFieldName(examFields, 'Section__c');

        String safeSubjectField = (subjectFieldName != null && subjectFieldName.replaceAll('[a-zA-Z0-9_]', '').length() == 0) ? subjectFieldName : null;
        String safeExtraField = (extraMarksField != null && extraMarksField.replaceAll('[a-zA-Z0-9_]', '').length() == 0) ? extraMarksField : null;

        List<Exam__c> exams = (List<Exam__c>)Security.stripInaccessible(AccessType.READABLE, Database.query(
            'SELECT Id, ' + String.escapeSingleQuotes(studentFld) + ', ' + String.escapeSingleQuotes(examTypeFld) + ', ' + String.escapeSingleQuotes(classFld) + ', ' + String.escapeSingleQuotes(sectionFld) +
            ( (!useJsonPath && safeSubjectField != null) ? (', ' + String.escapeSingleQuotes(safeSubjectField)) : '' ) +
            ( (safeExtraField != null) ? (', ' + String.escapeSingleQuotes(safeExtraField)) : '' ) +
            ' FROM Exam__c ' +
            ' WHERE ' + String.escapeSingleQuotes(studentFld)  + ' IN :studentIds ' +
            ' AND '   + String.escapeSingleQuotes(examTypeFld) + ' = :examType ' +
            ' AND '   + String.escapeSingleQuotes(classFld)    + ' = :classId ' +
            ( (sectionId != null) ? (' AND ' + String.escapeSingleQuotes(sectionFld) + ' = :sectionId ') : '' ) +
            ' '
        )).getRecords();
        for (Exam__c exam : exams) {
            Id sId = (Id)NamespaceUtils.getValue(exam, studentFld);
            if (sId != null) {
                examMarksMap.put(sId, exam);
            }
        }

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
                        marksValue = NamespaceUtils.getValue(exam, subjectFieldName);
                    } catch (Exception e) {
                    }
                } else if (extraMarksField != null) {
                    try {
                        String jsonStr = (String) NamespaceUtils.getValue(exam, extraMarksField);
                        if (String.isNotBlank(jsonStr)) {
                            Map<String, Object> extraMarks = (Map<String, Object>) JSON.deserializeUntyped(jsonStr);
                            if (extraMarks != null && extraMarks.containsKey(subjectName)) {
                                marksValue = extraMarks.get(subjectName);
                            }
                        }
                    } catch (Exception e) {
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
            throw new AuraHandledException('Error fetching student exams: ' + e.getMessage());
        }
    }

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

            Class__c classRec = (Class__c)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name, Section__c FROM Class__c WHERE Id = :classId LIMIT 1]).getRecords()[0];

            String subjectId   = (String) studentMarksDataList[0].get('subjectId');
            String subjectName = getSubjectNameById(subjectId);
            if (String.isBlank(subjectName)) {
                throw new AuraHandledException('Could not resolve subject name for ID: ' + subjectId);
            }

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

            Set<Id> studentIds = new Set<Id>();
            for (Map<String, Object> row : studentMarksDataList) {
                studentIds.add((Id) row.get('studentId'));
            }

            Map<Id, Account> studentMap = new Map<Id, Account>((List<Account>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name FROM Account WHERE Id IN :studentIds LIMIT 1000]).getRecords());

            Map<String, Schema.SObjectField> examFields = Schema.SObjectType.Exam__c.fields.getMap();
            String studentField  = getSafeFieldName(examFields, 'Student__c');
            String examTypeField = getSafeFieldName(examFields, 'Exam_Type__c');
            String classField    = getSafeFieldName(examFields, 'Class__c');
            String sectionField  = getSafeFieldName(examFields, 'Section__c');

            String safeExtra = (extraMarksField != null && extraMarksField.replaceAll('[a-zA-Z0-9_]', '').length() == 0) ? extraMarksField : null;

            Map<Id, Exam__c> examByStudent = new Map<Id, Exam__c>();
            for (Exam__c ex : (List<Exam__c>)Security.stripInaccessible(AccessType.READABLE, Database.query(
                'SELECT Id, ' + String.escapeSingleQuotes(studentField) + ', ' + String.escapeSingleQuotes(examTypeField) + ', ' + String.escapeSingleQuotes(classField) + ', ' + String.escapeSingleQuotes(sectionField) +
                (safeExtra != null ? (', ' + String.escapeSingleQuotes(safeExtra)) : '') +
                ' FROM Exam__c' +
                ' WHERE ' + String.escapeSingleQuotes(studentField) + ' IN :studentIds' +
                ' AND '   + String.escapeSingleQuotes(examTypeField) + ' = :examType ' +
                ' '
            )).getRecords()) {
                Id sId = (Id)NamespaceUtils.getValue(ex, studentField);
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
				    exam.Section__c   = sectionId;
                    Account stu = studentMap.get(studentId);
                    exam.Name = (stu != null ? stu.Name : String.valueOf(studentId))
                                + ' - ' + subjectName
                                + ' - ' + examType;
                }

                if (useJsonPath) {
                    if (extraMarksField != null) {
                        String existingJson = (String)NamespaceUtils.getValue(exam, extraMarksField);
                        Map<String, Object> extraMarks = new Map<String, Object>();
                        if (String.isNotBlank(existingJson)) {
                            try {
                                extraMarks = (Map<String, Object>) JSON.deserializeUntyped(existingJson);
                            } catch (Exception e) {
                            }
                        }
                        extraMarks.put(subjectName, marks.intValue());
                        exam.put(extraMarksField, JSON.serialize(extraMarks));
                    } else {
                        throw new AuraHandledException(
                            'No dedicated field and no Extra_Marks__c field found for subject: '
                            + subjectName
                            + '. Please add a field to Exam__c or an Extra_Marks__c text field.');
                    }
                } else {
                    if (isTextField) {
                        exam.put(subjectField, String.valueOf(marks.intValue()));
                    } else {
                        exam.put(subjectField, marks);
                    }
                }

                examsToUpsert.add(exam);
            }

            List<Exam__c> toInsert = new List<Exam__c>();
            List<Exam__c> toUpdate = new List<Exam__c>();
            for (Exam__c ex : examsToUpsert) {
                if (ex.Id != null) toUpdate.add(ex); else toInsert.add(ex);
            }
            if (!toInsert.isEmpty()) {
                SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, toInsert);
                insert decision.getRecords();
            }
            if (!toUpdate.isEmpty()) {
                SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, toUpdate);
                update decision.getRecords();
            }

            return 'Successfully saved marks for ' + examsToUpsert.size() + ' students';

        } catch (AuraHandledException ahe) {
            Database.rollback(sp);
            throw ahe;
        } catch (Exception e) {
            Database.rollback(sp);
            throw new AuraHandledException('Error saving marks: ' + e.getMessage());
        }
    }

    private static String getSubjectNameById(String subjectId) {
        if (String.isBlank(subjectId)) return null;
        try {
            List<Subject__c> subjects = [
                SELECT Id, Name FROM Subject__c WHERE Id = :subjectId WITH SECURITY_ENFORCED LIMIT 1
            ];
            if (!subjects.isEmpty()) return subjects[0].Name;
        } catch (Exception e) {
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
            for (Section__c sec : [SELECT Id, Name FROM Section__c WITH SECURITY_ENFORCED ORDER BY Name ASC LIMIT 500]) {
                options.add(new Map<String, String>{ 'label' => sec.Name, 'value' => sec.Id });
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching sections: ' + e.getMessage());
        }
        return options;
    }
}

