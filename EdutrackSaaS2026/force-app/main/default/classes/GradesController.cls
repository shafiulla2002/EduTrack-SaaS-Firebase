public with sharing class GradesController {

    private static final Set<String> EXCLUDED_FIELDS = new Set<String>{
        'exam_type__c', 'roll_no__c', 'roll_number__c',
        'section__c', 'class__c', 'student__c',
        'extra_marks__c', 'isdeleted', 'ownerid',
        'createdbyid', 'lastmodifiedbyid',
        'lastreferenceddate', 'lastvieweddate',
        'exam_type__c', 'roll_no__c', 'roll_number__c', 'section__c', 'class__c',
        'student__c', 'name', 'id', 'createddate', 'lastmodifieddate',
        'systemmodstamp', 'extra_marks__c', 'isdeleted', 'ownerid',
        'createdbyid', 'lastmodifiedbyid', 'lastreferenceddate', 'lastvieweddate'
    };
    
    private static String getSafeFieldName(Map<String, Schema.SObjectField> fields, String localName) {
        if (fields.containsKey(localName.toLowerCase())) return fields.get(localName.toLowerCase()).getDescribe().getName();
        String namespaced = 'EduTrack__' + localName;
        if (fields.containsKey(namespaced.toLowerCase())) return fields.get(namespaced.toLowerCase()).getDescribe().getName();
        return localName;
    }

    private static List<String> getSubjectFieldNames() {
        List<String> subjectFields = new List<String>();
        Map<String, Schema.SObjectField> fields = Schema.SObjectType.Exam__c.fields.getMap();
        for (String fieldName : fields.keySet()) {
            Schema.DescribeFieldResult dfr = fields.get(fieldName).getDescribe();
            String localNameLower = dfr.getLocalName().toLowerCase();
            String fullNameLower  = dfr.getName().toLowerCase();
            if (!dfr.isCustom()) continue;
            if (EXCLUDED_FIELDS.contains(localNameLower)) continue;
            if (EXCLUDED_FIELDS.contains(fullNameLower))  continue;
            Schema.DisplayType dt = dfr.getType();
            if (dt == Schema.DisplayType.Double   ||
                dt == Schema.DisplayType.Integer  ||
                dt == Schema.DisplayType.Percent  ||
                dt == Schema.DisplayType.Currency ||
                dt == Schema.DisplayType.String) {
                subjectFields.add(dfr.getName());
            }
        }
        return subjectFields;
    }

    @AuraEnabled
    public static Map<String, Object> getInitialData() {
        try {
            Map<String, Object> result = new Map<String, Object>();

            // Test Types
            List<String> testTypes = new List<String>();
            for (Schema.PicklistEntry entry : Exam__c.Exam_Type__c.getDescribe().getPicklistValues()) {
                if (entry.isActive()) testTypes.add(entry.getLabel());
            }
            result.put('testTypes', testTypes);

            // Class Options
            List<Map<String, String>> classOptions = new List<Map<String, String>>();
            for (Class__c cls : (List<Class__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name FROM Class__c ORDER BY Name ASC LIMIT 500]).getRecords()) {
                classOptions.add(new Map<String, String>{
                    'label' => cls.Name,
                    'value' => cls.Name
                });
            }
            result.put('classOptions', classOptions);

            // Section Options
            List<Map<String, String>> sectionOptions = new List<Map<String, String>>();
            for (Section__c sec : (List<Section__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name FROM Section__c ORDER BY Name ASC LIMIT 500]).getRecords()) {
                sectionOptions.add(new Map<String, String>{
                    'label' => sec.Name,
                    'value' => sec.Name
                });
            }
            result.put('sectionOptions', sectionOptions);

            // Build Exam Field Map — keyed by label and by full API name
            Map<String, String> examFieldByLabel = new Map<String, String>();
            Map<String, Schema.SObjectField> examFields = Schema.SObjectType.Exam__c.fields.getMap();

            for (String fieldName : examFields.keySet()) {
                Schema.DescribeFieldResult dfr = examFields.get(fieldName).getDescribe();
                if (!dfr.isCustom()) continue;
                String fullNameLower  = dfr.getName().toLowerCase();
                String localNameLower = dfr.getLocalName().toLowerCase();
                if (EXCLUDED_FIELDS.contains(fullNameLower))  continue;
                if (EXCLUDED_FIELDS.contains(localNameLower)) continue;

                Schema.DisplayType dt = dfr.getType();
                if (dt == Schema.DisplayType.Double   ||
                    dt == Schema.DisplayType.Integer  ||
                    dt == Schema.DisplayType.Percent  ||
                    dt == Schema.DisplayType.Currency ||
                    dt == Schema.DisplayType.String) {

                    // Map by label (e.g. "hindi" → "Hindi__c")
                    examFieldByLabel.put(dfr.getLabel().toLowerCase(), dfr.getName());
                    // Map by full API name lowercase (e.g. "hindi__c" → "Hindi__c")
                    examFieldByLabel.put(dfr.getName().toLowerCase(), dfr.getName());
                    // Map by local name stripped (e.g. "hindi" → "Hindi__c")
                    String clean = dfr.getLocalName().toLowerCase().replace('__c','').replace('_','');
                    examFieldByLabel.put(clean, dfr.getName());
                }
            }

            // Fetch Subjects and match to Exam 
            List<Map<String, String>> subjectMeta = new List<Map<String, String>>();
            for (Subject__c sub : [SELECT Id, Name FROM Subject__c WITH SECURITY_ENFORCED ORDER BY Name ASC LIMIT 500]) {
                String subjectLabel = sub.Name;
                String key = subjectLabel.toLowerCase();
                String cleanKey = key.replace(' ', '');
                
                String matchedField = examFieldByLabel.get(key);
                if (matchedField == null) matchedField = examFieldByLabel.get(cleanKey);
                
                if (matchedField == null) {
                    for (String k : examFieldByLabel.keySet()) {
                        if (k.contains(key) || key.contains(k)) {
                            matchedField = examFieldByLabel.get(k);
                            break;
                        }
                    }
                }
                
                if (matchedField != null && matchedField.contains('__') && 
                    matchedField.indexOf('__') != matchedField.lastIndexOf('__')) {
                    matchedField = matchedField.substringAfter('__');
                }

                subjectMeta.add(new Map<String, String>{
                    'label' => subjectLabel,
                    'field' => (matchedField != null ? matchedField : '')
                });
            }
            result.put('subjects', subjectMeta);

            return result;
        } catch (Exception e) {
            throw new AuraHandledException('Error initializing data: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static List<Map<String, Object>> getGradesData(
        String className, String sectionName, String examType, String searchTerm
    ) {
        List<String> subjectFields = getSubjectFieldNames();
        String examSelect = String.join(subjectFields, ', ');

        Map<String, Schema.SObjectField> examFields = Schema.SObjectType.Exam__c.fields.getMap();
        String examTypeField = getSafeFieldName(examFields, 'Exam_Type__c');
        String extraMarksField = getSafeFieldName(examFields, 'Extra_Marks__c');

        Map<String, Schema.SObjectField> accFields = Schema.SObjectType.Account.fields.getMap();
        String rollNoField = getSafeFieldName(accFields, 'Roll_No__c');
        String classField = getSafeFieldName(accFields, 'Class__c');
        String sectionField = getSafeFieldName(accFields, 'Section__c');

        // Bind variables for the query
        Id classId = null;
        if (String.isNotBlank(className)) {
            List<Class__c> clsList = [SELECT Id FROM Class__c WHERE Name = :className WITH SECURITY_ENFORCED LIMIT 1];
            if (!clsList.isEmpty()) classId = clsList[0].Id;
        }
        Id sectionId = null;
        if (String.isNotBlank(sectionName)) {
            List<Section__c> secList = [SELECT Id FROM Section__c WHERE Name = :sectionName WITH SECURITY_ENFORCED LIMIT 1];
            if (!secList.isEmpty()) sectionId = secList[0].Id;
        }
        String likeTerm = String.isNotBlank(searchTerm) ? '%' + searchTerm + '%' : null;

        try {
            List<Account> rawStudents = Database.query(
                'SELECT Id, Name, ' + String.escapeSingleQuotes(rollNoField) + ', ' + String.escapeSingleQuotes(classField) + ', ' + String.escapeSingleQuotes(classField.replace('__c', '__r')) + '.Name, ' +
                String.escapeSingleQuotes(sectionField) + ', ' + String.escapeSingleQuotes(sectionField.replace('__c', '__r')) + '.Name, ' +
                '(SELECT Id, ' + String.escapeSingleQuotes(examTypeField) + ', ' + String.escapeSingleQuotes(extraMarksField) + (String.isNotBlank(examSelect) ? (', ' + String.escapeSingleQuotes(examSelect)) : '') + ' FROM Exams__r' +
                (String.isNotBlank(examType) ? (' WHERE ' + String.escapeSingleQuotes(examTypeField) + ' = :examType') : '') + ')' +
                ' FROM Account WHERE Type = \'Student\'' +
                (classId != null ? (' AND ' + String.escapeSingleQuotes(classField) + ' = :classId') : '') +
                (sectionId != null ? (' AND ' + String.escapeSingleQuotes(sectionField) + ' = :sectionId') : '') +
                (likeTerm != null ? (' AND (Name LIKE :likeTerm OR ' + String.escapeSingleQuotes(rollNoField) + ' LIKE :likeTerm)') : '') +
                ' WITH SECURITY_ENFORCED ORDER BY Name LIMIT 1000'
            );
            List<Account> students = (List<Account>) Security.stripInaccessible(AccessType.READABLE, rawStudents).getRecords();
            
            Map<String, Schema.SObjectField> fields = Schema.SObjectType.Exam__c.fields.getMap();
            List<Map<String, Object>> results = new List<Map<String, Object>>();

            for (Account s : students) {
                Map<String, Object> row = new Map<String, Object>();
                row.put('Id', s.Id);
                row.put('StudentId', s.Id);
                row.put('Name', s.Name);
                
                // Use get() with string literal or a safe way to handle potential stripping on account fields if needed, 
                // but since we are without sharing now, we can use s.Roll_No__c or similar.
                // However, the fields were queried using getSafeFieldName, so they might have namespaces.
                
                Object rollVal = NamespaceUtils.getValue(s, rollNoField);
                row.put('Roll_No__c', rollVal);

                String classRel = classField.endsWith('__c') ? classField.substringBeforeLast('__c') + '__r' : classField;
                SObject classRef = (SObject) NamespaceUtils.getValue(s, classRel);
                row.put('Class__c',   classRef != null ? classRef.get('Name') : '');
                
                String sectionRel = sectionField.endsWith('__c') ? sectionField.substringBeforeLast('__c') + '__r' : sectionField;
                SObject sectionRef = (SObject) NamespaceUtils.getValue(s, sectionRel);
                row.put('Section__c', sectionRef != null ? sectionRef.get('Name') : '');

                Exam__c matchingExam = (s.Exams__r != null && !s.Exams__r.isEmpty())
                    ? s.Exams__r[0] : null;
                row.put('Exam_Type__c', matchingExam != null ? NamespaceUtils.getValue(matchingExam, examTypeField) : examType);

                for (String f : subjectFields) {
                    // f is the full API name from getSubjectFieldNames()
                    String apiName = f;
                    String key = apiName.contains('__') && apiName.indexOf('__') != apiName.lastIndexOf('__') 
                                 ? apiName.substringAfter('__') : apiName;

                    Object val = null;
                    if (matchingExam != null) {
                        val = NamespaceUtils.getValue(matchingExam, apiName);
                    }

                    if (val == null) {
                        row.put(key, 0);
                    } else if (val instanceof String) {
                        try { row.put(key, Decimal.valueOf((String) val)); }
                        catch (Exception ex) { row.put(key, 0); }
                    } else {
                        row.put(key, val);
                    }
                }
                results.add(row);
            }
            return results;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching grades: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static List<Map<String, Object>> getStudentExams(String studentId) {
        try {
            List<String> subjectFields = getSubjectFieldNames();
            Map<String, Schema.SObjectField> fields = Schema.SObjectType.Exam__c.fields.getMap();
            String examSelect = String.join(subjectFields, ', ');

            Map<String, Schema.SObjectField> examFields = Schema.SObjectType.Exam__c.fields.getMap();
            String examTypeField = getSafeFieldName(examFields, 'Exam_Type__c');
            String extraMarksField = getSafeFieldName(examFields, 'Extra_Marks__c');
            String classField = getSafeFieldName(examFields, 'Class__c');
            String sectionField = getSafeFieldName(examFields, 'Section__c');
            String studentField = getSafeFieldName(examFields, 'Student__c');

            String examSelectSafe = String.isNotBlank(examSelect) ? examSelect : 'Id';
            List<Exam__c> rawExams = Database.query(
                'SELECT Id, ' + String.escapeSingleQuotes(examTypeField) + ', ' +
                String.escapeSingleQuotes(classField) + ', ' + String.escapeSingleQuotes(classField.replace('__c', '__r')) + '.Name, ' +
                String.escapeSingleQuotes(sectionField) + ', ' + String.escapeSingleQuotes(sectionField.replace('__c', '__r')) + '.Name, ' +
                String.escapeSingleQuotes(extraMarksField) + ', ' + String.escapeSingleQuotes(examSelectSafe) +
                ' FROM Exam__c WHERE ' + String.escapeSingleQuotes(studentField) + ' = :studentId WITH SECURITY_ENFORCED ORDER BY CreatedDate DESC LIMIT 500'
            );
            List<Exam__c> exams = (List<Exam__c>)Security.stripInaccessible(AccessType.READABLE, rawExams).getRecords();
            List<Map<String, Object>> results = new List<Map<String, Object>>();

            for (Exam__c e : exams) {
                Map<String, Object> row = new Map<String, Object>();
                row.put('Id', e.Id);
                String classRel = classField.endsWith('__c') ? classField.substringBeforeLast('__c') + '__r' : classField;
                SObject classRef = (SObject) NamespaceUtils.getValue(e, classRel);
                row.put('Class__c',   classRef != null ? classRef.get('Name') : '');
                
                String sectionRel = sectionField.endsWith('__c') ? sectionField.substringBeforeLast('__c') + '__r' : sectionField;
                SObject sectionRef = (SObject) NamespaceUtils.getValue(e, sectionRel);
                row.put('Section__c', sectionRef != null ? sectionRef.get('Name') : '');
                
                // Use a more resilient way to get extra marks
                Object extraVal = NamespaceUtils.getValue(e, extraMarksField);
                row.put('Extra_Marks__c', extraVal);
                
                // ✅ KEY FIX: Include Exam_Type__c so LWC can filter results
                Object typeVal = NamespaceUtils.getValue(e, examTypeField);
                row.put('Exam_Type__c', typeVal);

                for (String f : subjectFields) {
                    // f is the full API name
                    String apiName = f;
                    String key = apiName.contains('__') && apiName.indexOf('__') != apiName.lastIndexOf('__') 
                                 ? apiName.substringAfter('__') : apiName;

                    Object val = NamespaceUtils.getValue(e, apiName);

                    if (val == null) {
                        row.put(key, 0);
                    } else if (val instanceof String) {
                        try { row.put(key, Decimal.valueOf((String) val)); }
                        catch (Exception ex) { row.put(key, 0); }
                    } else {
                        row.put(key, val);
                    }
                }
                results.add(row);
            }
            return results;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching student exams: ' + e.getMessage());
        }
    }
}





