public with sharing class GradesController {

    private static final Set<String> EXCLUDED_FIELDS = new Set<String>{
        'edutrack__exam_type__c', 'edutrack__roll_no__c', 'edutrack__roll_number__c',
        'edutrack__section__c', 'edutrack__class__c', 'edutrack__student__c',
        'edutrack__extra_marks__c', 'edutrack__isdeleted', 'edutrack__ownerid',
        'edutrack__createdbyid', 'edutrack__lastmodifiedbyid',
        'edutrack__lastreferenceddate', 'edutrack__lastvieweddate',
        'exam_type__c', 'roll_no__c', 'roll_number__c', 'section__c', 'class__c',
        'student__c', 'name', 'id', 'createddate', 'lastmodifieddate',
        'systemmodstamp', 'extra_marks__c', 'isdeleted', 'ownerid',
        'createdbyid', 'lastmodifiedbyid', 'lastreferenceddate', 'lastvieweddate'
    };

    private static List<String> getSubjectFieldNames() {
        List<String> subjectFields = new List<String>();
        Map<String, Schema.SObjectField> fields = Schema.SObjectType.EduTrack__Exam__c.fields.getMap();
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
                subjectFields.add(dfr.getName()); // ✅ full API name e.g. EduTrack__Hindi__c
            }
        }
        return subjectFields;
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getInitialData() {
        try {
            Map<String, Object> result = new Map<String, Object>();

            // Test Types
            List<String> testTypes = new List<String>();
            for (Schema.PicklistEntry entry : EduTrack__Exam__c.EduTrack__Exam_Type__c.getDescribe().getPicklistValues()) {
                if (entry.isActive()) testTypes.add(entry.getLabel());
            }
            result.put('testTypes', testTypes);

            // Class Options
            List<Map<String, String>> classOptions = new List<Map<String, String>>();
            for (EduTrack__Class__c cls : [SELECT Id, Name FROM EduTrack__Class__c ORDER BY Name ASC]) {
                classOptions.add(new Map<String, String>{
                    'label' => cls.Name,
                    'value' => cls.Name
                });
            }
            result.put('classOptions', classOptions);

            // Section Options
            List<Map<String, String>> sectionOptions = new List<Map<String, String>>();
            for (EduTrack__Section__c sec : [SELECT Id, Name FROM EduTrack__Section__c ORDER BY Name ASC]) {
                sectionOptions.add(new Map<String, String>{
                    'label' => sec.Name,
                    'value' => sec.Name
                });
            }
            result.put('sectionOptions', sectionOptions);

            // Build Exam Field Map — keyed by label and by full API name
            Map<String, String> examFieldByLabel = new Map<String, String>();
            Map<String, Schema.SObjectField> examFields = Schema.SObjectType.EduTrack__Exam__c.fields.getMap();

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

                    // Map by label (e.g. "hindi" → "EduTrack__Hindi__c")
                    examFieldByLabel.put(dfr.getLabel().toLowerCase(), dfr.getName());
                    // Map by full API name lowercase (e.g. "edutrack__hindi__c" → "EduTrack__Hindi__c")
                    examFieldByLabel.put(dfr.getName().toLowerCase(), dfr.getName());
                    // Map by local name stripped (e.g. "hindi" → "EduTrack__Hindi__c")
                    String clean = dfr.getLocalName().toLowerCase().replace('__c','').replace('_','');
                    examFieldByLabel.put(clean, dfr.getName());
                }
            }

            // Fetch Subjects and match to Exam fields
            List<Map<String, String>> subjectMeta = new List<Map<String, String>>();
            for (EduTrack__Subject__c sub : [SELECT Id, Name FROM EduTrack__Subject__c ORDER BY Name ASC]) {
                String subjectLabel = sub.Name;
                String key = subjectLabel.toLowerCase();

                String matchedField = examFieldByLabel.get(key);

                if (matchedField == null) {
                    matchedField = examFieldByLabel.get(key.replace(' ', ''));
                }

                if (matchedField == null) {
                    for (String k : examFieldByLabel.keySet()) {
                        if (k.contains(key) || key.contains(k)) {
                            matchedField = examFieldByLabel.get(k);
                            break;
                        }
                    }
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

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getGradesData(
        String className, String sectionName, String examType, String searchTerm
    ) {
        List<String> subjectFields = getSubjectFieldNames();
        String examSelect = String.join(subjectFields, ', ');

        String subQuery = '(SELECT Id, EduTrack__Exam_Type__c, EduTrack__Extra_Marks__c, ' + examSelect + ' FROM EduTrack__Exams__r';
        if (String.isNotBlank(examType)) {
            subQuery += ' WHERE EduTrack__Exam_Type__c = \'' + String.escapeSingleQuotes(examType) + '\'';
        }
        subQuery += ')';

        String query = 'SELECT Id, Name, EduTrack__Roll_No__c, ' +
                       'EduTrack__Class__c, EduTrack__Class__r.Name, ' +
                       'EduTrack__Section__c, EduTrack__Section__r.Name, ' +
                       subQuery +
                       ' FROM Account WHERE Type = \'Student\'';

        if (String.isNotBlank(className)) {
            List<EduTrack__Class__c> clsList = [SELECT Id FROM EduTrack__Class__c WHERE Name = :className LIMIT 1];
            if (!clsList.isEmpty()) {
                Id classId = clsList[0].Id;
                query += ' AND EduTrack__Class__c = :classId';
            }
        }
        if (String.isNotBlank(sectionName)) {
            List<EduTrack__Section__c> secList = [SELECT Id FROM EduTrack__Section__c WHERE Name = :sectionName LIMIT 1];
            if (!secList.isEmpty()) {
                Id sectionId = secList[0].Id;
                query += ' AND EduTrack__Section__c = :sectionId';
            }
        }
        if (String.isNotBlank(searchTerm)) {
            String sp = '%' + searchTerm + '%';
            query += ' AND (Name LIKE :sp OR EduTrack__Roll_No__c LIKE :sp)';
        }
        query += ' ORDER BY Name';

        try {
            List<Account> students = Database.query(query);
            Map<String, Schema.SObjectField> fields = Schema.SObjectType.EduTrack__Exam__c.fields.getMap();
            List<Map<String, Object>> results = new List<Map<String, Object>>();

            for (Account s : students) {
                Map<String, Object> row = new Map<String, Object>();
                row.put('Id', s.Id);
                row.put('StudentId', s.Id);
                row.put('Name', s.Name);
                row.put('Roll_No__c', s.EduTrack__Roll_No__c);
                row.put('Class__c',   s.EduTrack__Class__r   != null ? s.EduTrack__Class__r.Name   : '');
                row.put('Section__c', s.EduTrack__Section__r != null ? s.EduTrack__Section__r.Name : '');

                EduTrack__Exam__c matchingExam = (s.EduTrack__Exams__r != null && !s.EduTrack__Exams__r.isEmpty())
                    ? s.EduTrack__Exams__r[0] : null;
                row.put('Exam_Type__c', matchingExam != null ? matchingExam.EduTrack__Exam_Type__c : examType);

                for (String f : subjectFields) {
                    // ✅ KEY FIX: use getName() (full API name) as the map key
                    //    so JS subjectMeta.field lookup matches exactly
                    Schema.DescribeFieldResult dfr = fields.get(f.toLowerCase()).getDescribe();
                    String apiName = dfr.getName(); // e.g. EduTrack__Hindi__c

                    Object val = (matchingExam != null) ? matchingExam.get(f) : null;
                    if (val == null) {
                        row.put(apiName, 0);
                    } else if (val instanceof String) {
                        try { row.put(apiName, Decimal.valueOf((String) val)); }
                        catch (Exception ex) { row.put(apiName, 0); }
                    } else {
                        row.put(apiName, val);
                    }
                }
                results.add(row);
            }
            return results;

        } catch (Exception e) {
            throw new AuraHandledException('Error fetching grades: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getStudentExams(String studentId) {
        try {
            List<String> subjectFields = getSubjectFieldNames();
            Map<String, Schema.SObjectField> fields = Schema.SObjectType.EduTrack__Exam__c.fields.getMap();
            String examSelect = String.join(subjectFields, ', ');

            String query = 'SELECT Id, EduTrack__Exam_Type__c, ' +
                           'EduTrack__Class__c, EduTrack__Class__r.Name, ' +
                           'EduTrack__Section__c, EduTrack__Section__r.Name, ' +
                           'EduTrack__Extra_Marks__c, ' + examSelect +
                           ' FROM EduTrack__Exam__c WHERE EduTrack__Student__c = :studentId ORDER BY CreatedDate DESC';

            List<EduTrack__Exam__c> exams = Database.query(query);
            List<Map<String, Object>> results = new List<Map<String, Object>>();

            for (EduTrack__Exam__c e : exams) {
                Map<String, Object> row = new Map<String, Object>();
                row.put('Id', e.Id);
                row.put('Exam_Type__c', e.EduTrack__Exam_Type__c);
                row.put('Class__c',   e.EduTrack__Class__r   != null ? e.EduTrack__Class__r.Name   : '');
                row.put('Section__c', e.EduTrack__Section__r != null ? e.EduTrack__Section__r.Name : '');
                row.put('Extra_Marks__c', e.EduTrack__Extra_Marks__c);

                for (String f : subjectFields) {
                    // ✅ KEY FIX: use getName() (full API name) as the map key
                    Schema.DescribeFieldResult dfr = fields.get(f.toLowerCase()).getDescribe();
                    String apiName = dfr.getName(); // e.g. EduTrack__Hindi__c

                    Object val = e.get(f);
                    if (val == null) {
                        row.put(apiName, 0);
                    } else if (val instanceof String) {
                        try { row.put(apiName, Decimal.valueOf((String) val)); }
                        catch (Exception ex) { row.put(apiName, 0); }
                    } else {
                        row.put(apiName, val);
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