public with sharing class GradesController {

    private static final Set<String> EXCLUDED_FIELDS = new Set<String>{
        'exam_type__c', 'roll_no__c', 'roll_number__c', 'section__c', 'class__c',
        'student__c', 'name', 'id', 'createddate', 'lastmodifieddate',
        'systemmodstamp', 'extra_marks__c', 'isdeleted', 'ownerid',
        'createdbyid', 'lastmodifiedbyid', 'lastreferenceddate', 'lastvieweddate'
    };

    private static List<String> getSubjectFieldNames() {
        List<String> subjectFields = new List<String>();
        Map<String, Schema.SObjectField> fields = Schema.SObjectType.Exam__c.fields.getMap();
        for (String fieldName : fields.keySet()) {
            Schema.DescribeFieldResult dfr = fields.get(fieldName).getDescribe();
            String localNameLower = dfr.getLocalName().toLowerCase();
            if (!dfr.isCustom()) continue;
            if (EXCLUDED_FIELDS.contains(localNameLower)) continue;
            if (EXCLUDED_FIELDS.contains(dfr.getName().toLowerCase())) continue;
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

   @AuraEnabled(cacheable=true)
public static Map<String, Object> getInitialData() {
    try {
        Map<String, Object> result = new Map<String, Object>();

        // ✅ Test Types
        List<String> testTypes = new List<String>();
        for (Schema.PicklistEntry entry : Exam__c.Exam_Type__c.getDescribe().getPicklistValues()) {
            if (entry.isActive()) testTypes.add(entry.getLabel());
        }
        result.put('testTypes', testTypes);

        // ✅ Class Options
        List<Map<String, String>> classOptions = new List<Map<String, String>>();
        for (Class__c cls : [SELECT Id, Name FROM Class__c ORDER BY Name ASC]) {
            classOptions.add(new Map<String, String>{
                'label' => cls.Name,
                'value' => cls.Name
            });
        }
        result.put('classOptions', classOptions);

        // ✅ Section Options
        List<Map<String, String>> sectionOptions = new List<Map<String, String>>();
        for (Section__c sec : [SELECT Id, Name FROM Section__c ORDER BY Name ASC]) {
            sectionOptions.add(new Map<String, String>{
                'label' => sec.Name,
                'value' => sec.Name
            });
        }
        result.put('sectionOptions', sectionOptions);

        // ✅ STEP 1: Build Exam Field Map
        Map<String, String> examFieldByLabel = new Map<String, String>();

        Map<String, Schema.SObjectField> examFields = Schema.SObjectType.Exam__c.fields.getMap();

        for (String fieldName : examFields.keySet()) {
            Schema.DescribeFieldResult dfr = examFields.get(fieldName).getDescribe();

            if (!dfr.isCustom()) continue;
            if (EXCLUDED_FIELDS.contains(dfr.getName().toLowerCase())) continue;

            Schema.DisplayType dt = dfr.getType();
            if (dt == Schema.DisplayType.Double ||
                dt == Schema.DisplayType.Integer ||
                dt == Schema.DisplayType.Percent ||
                dt == Schema.DisplayType.Currency ||
                dt == Schema.DisplayType.String) {

                // Map by label
                examFieldByLabel.put(dfr.getLabel().toLowerCase(), dfr.getName());

                // Map stripped name (Hindi__c → hindi)
                String clean = dfr.getName().toLowerCase().replace('__c','').replace('_','');
                examFieldByLabel.put(clean, dfr.getName());
            }
        }

        // ✅ STEP 2: Fetch Subjects from Subject__c
        List<Map<String, String>> subjectMeta = new List<Map<String, String>>();

        for (Subject__c sub : [SELECT Id, Name FROM Subject__c ORDER BY Name ASC]) {

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

        String subQuery = '(SELECT Id, Exam_Type__c, Extra_Marks__c, ' + examSelect + ' FROM Exams__r';
        if (String.isNotBlank(examType)) {
            subQuery += ' WHERE Exam_Type__c = \'' + String.escapeSingleQuotes(examType) + '\'';
        }
        subQuery += ')';

        // ✅ FIX: Include relationship names in SELECT
        String query = 'SELECT Id, Name, Roll_No__c, ' +
                       'Class__c, Class__r.Name, ' +
                       'Section__c, Section__r.Name, ' +
                       subQuery +
                       ' FROM Account WHERE Type = \'Student\'';

        // ✅ FIX: Resolve lookup Name → Id for filters
        if (String.isNotBlank(className)) {
            List<Class__c> clsList = [SELECT Id FROM Class__c WHERE Name = :className LIMIT 1];
            if (!clsList.isEmpty()) {
                Id classId = clsList[0].Id;
                query += ' AND Class__c = :classId';
            }
        }
        if (String.isNotBlank(sectionName)) {
            List<Section__c> secList = [SELECT Id FROM Section__c WHERE Name = :sectionName LIMIT 1];
            if (!secList.isEmpty()) {
                Id sectionId = secList[0].Id;
                query += ' AND Section__c = :sectionId';
            }
        }
        if (String.isNotBlank(searchTerm)) {
            String sp = '%' + searchTerm + '%';
            query += ' AND (Name LIKE :sp OR Roll_No__c LIKE :sp)';
        }
        query += ' ORDER BY Name';

        try {
            List<Account> students = Database.query(query);
            Map<String, Schema.SObjectField> fields = Schema.SObjectType.Exam__c.fields.getMap();
            List<Map<String, Object>> results = new List<Map<String, Object>>();

            for (Account s : students) {
                Map<String, Object> row = new Map<String, Object>();
                row.put('Id', s.Id);
                row.put('StudentId', s.Id);
                row.put('Name', s.Name);
                row.put('Roll_No__c', s.Roll_No__c);
                // ✅ FIX: Use relationship name, not raw ID
                row.put('Class__c',   s.Class__r   != null ? s.Class__r.Name   : '');
                row.put('Section__c', s.Section__r != null ? s.Section__r.Name : '');

                Exam__c matchingExam = (s.Exams__r != null && !s.Exams__r.isEmpty())
                    ? s.Exams__r[0] : null;
                row.put('Exam_Type__c', matchingExam != null ? matchingExam.Exam_Type__c : examType);

                for (String f : subjectFields) {
                    Schema.DescribeFieldResult dfr = fields.get(f).getDescribe();
                    String localName = dfr.getLocalName();
                    Object val = (matchingExam != null) ? matchingExam.get(f) : null;
                    if (val == null) {
                        row.put(localName, 0);
                    } else if (val instanceof String) {
                        try { row.put(localName, Decimal.valueOf((String) val)); }
                        catch (Exception ex) { row.put(localName, 0); }
                    } else {
                        row.put(localName, val);
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
            Map<String, Schema.SObjectField> fields = Schema.SObjectType.Exam__c.fields.getMap();
            String examSelect = String.join(subjectFields, ', ');

            // ✅ FIX: Include relationship names
            String query = 'SELECT Id, Exam_Type__c, ' +
                           'Class__c, Class__r.Name, ' +
                           'Section__c, Section__r.Name, ' +
                           'Extra_Marks__c, ' + examSelect +
                           ' FROM Exam__c WHERE Student__c = :studentId ORDER BY CreatedDate DESC';

            List<Exam__c> exams = Database.query(query);
            List<Map<String, Object>> results = new List<Map<String, Object>>();

            for (Exam__c e : exams) {
                Map<String, Object> row = new Map<String, Object>();
                row.put('Id', e.Id);
                row.put('Exam_Type__c', e.Exam_Type__c);
                // ✅ FIX: Use relationship name
                row.put('Class__c',   e.Class__r   != null ? e.Class__r.Name   : '');
                row.put('Section__c', e.Section__r != null ? e.Section__r.Name : '');
                row.put('Extra_Marks__c', e.Extra_Marks__c);

                for (String f : subjectFields) {
                    Schema.DescribeFieldResult dfr = fields.get(f).getDescribe();
                    String localName = dfr.getLocalName();
                    Object val = e.get(f);
                    if (val == null) {
                        row.put(localName, 0);
                    } else if (val instanceof String) {
                        try { row.put(localName, Decimal.valueOf((String) val)); }
                        catch (Exception ex) { row.put(localName, 0); }
                    } else { 
                        row.put(localName, val);
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