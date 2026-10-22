public with sharing class GradesController {
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getInitialData() {
        try {
            Map<String, Object> result = new Map<String, Object>();
            
            // 1. Fetch Exam Type picklist values from Exam__c
            List<String> testTypes = new List<String>();
            Schema.DescribeFieldResult testField = Exam__c.Exam_Type__c.getDescribe();
            for (Schema.PicklistEntry entry : testField.getPicklistValues()) {
                if (entry.isActive()) testTypes.add(entry.getLabel());
            }
            result.put('testTypes', testTypes);
            
            // 2. Fetch Class picklist values from Account
            List<Map<String, String>> classOptions = new List<Map<String, String>>();
            Schema.DescribeFieldResult classField = Account.Class__c.getDescribe();
            for (Schema.PicklistEntry entry : classField.getPicklistValues()) {
                if (entry.isActive()) {
                    classOptions.add(new Map<String, String>{'label' => entry.getLabel(), 'value' => entry.getValue()});
                }
            }
            result.put('classOptions', classOptions);
            
            // 3. Fetch Section picklist values from Account
            List<Map<String, String>> sectionOptions = new List<Map<String, String>>();
            Schema.DescribeFieldResult sectionField = Account.Section__c.getDescribe();
            for (Schema.PicklistEntry entry : sectionField.getPicklistValues()) {
                if (entry.isActive()) {
                    sectionOptions.add(new Map<String, String>{'label' => entry.getLabel(), 'value' => entry.getValue()});
                }
            }
            result.put('sectionOptions', sectionOptions);
            
            // 4. Identify Subject Fields dynamically
            List<Map<String, String>> subjectMeta = new List<Map<String, String>>();
            Map<String, Schema.SObjectField> fields = Schema.SObjectType.Exam__c.fields.getMap();
            Set<String> excluded = new Set<String>{'Exam_Type__c', 'Roll_Number__c', 'Section__c', 'Class__c', 'Student__c', 'Name', 'Id', 'CreatedDate', 'LastModifiedDate', 'SystemModstamp'};
            
            for (String fieldName : fields.keySet()) {
                Schema.DescribeFieldResult dfr = fields.get(fieldName).getDescribe();
                if (dfr.isCustom() && !excluded.contains(dfr.getName()) && !excluded.contains(dfr.getLocalName())) {
                    Schema.DisplayType dt = dfr.getType();
                    if (dt == Schema.DisplayType.Double || dt == Schema.DisplayType.Integer || dt == Schema.DisplayType.Percent || dt == Schema.DisplayType.String) {
                        subjectMeta.add(new Map<String, String>{
                            'label' => dfr.getLabel(), 
                            'field' => dfr.getLocalName()
                        }); 
                    }
                }
            }
            result.put('subjects', subjectMeta);
            
            return result;
        } catch (Exception e) {
            throw new AuraHandledException('Error initializing data: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getGradesData(String className, String sectionName, String examType, String searchTerm) {
        // 1. Identify Subject Fields dynamically
        List<String> subjectFields = new List<String>();
        Map<String, String> fieldToLocalMap = new Map<String, String>();
        Map<String, Schema.SObjectField> fields = Schema.SObjectType.Exam__c.fields.getMap();
        Set<String> excluded = new Set<String>{'Exam_Type__c', 'Roll_No__c', 'Roll_Number__c', 'Section__c', 'Class__c', 'Student__c', 'Name', 'Id', 'CreatedDate', 'LastModifiedDate', 'SystemModstamp'};
        
        for (String fieldName : fields.keySet()) {
            Schema.DescribeFieldResult dfr = fields.get(fieldName).getDescribe();
            if (dfr.isCustom() && !excluded.contains(dfr.getName()) && !excluded.contains(dfr.getLocalName())) {
                Schema.DisplayType dt = dfr.getType();
                if (dt == Schema.DisplayType.Double || dt == Schema.DisplayType.Integer || dt == Schema.DisplayType.Percent || dt == Schema.DisplayType.String) {
                    subjectFields.add(dfr.getName()); // Full API Name
                    fieldToLocalMap.put(dfr.getName(), dfr.getLocalName()); // Local Name
                }
            }
        }
        
        // 1b. Resolve Relationship Name
        String examsRelName = 'Exams__r';
        for(Schema.ChildRelationship rel : Schema.SObjectType.Account.getChildRelationships()) {
            if(rel.getChildSObject() == Exam__c.sObjectType) {
                examsRelName = rel.getRelationshipName();
                break;
            }
        }
        
        // 1c. Resolve Account field names
        String accRollField = Account.Roll_No__c.getDescribe().getName();
        String accClassField = Account.Class__c.getDescribe().getName();
        String accSectionField = Account.Section__c.getDescribe().getName();
        
        // 2. Build Query on Account (All Students)
        String examSelect = subjectFields.isEmpty() ? 'Id' : String.join(subjectFields, ', ');
        String subQuery = '(SELECT Id, Exam_Type__c, ' + examSelect + ' FROM ' + examsRelName;
        if (String.isNotBlank(examType)) {
            subQuery += ' WHERE Exam_Type__c = \'' + String.escapeSingleQuotes(examType) + '\'';
        }
        subQuery += ' ORDER BY CreatedDate DESC)';
        
        String query = 'SELECT Id, Name, ' + accRollField + ', ' + accClassField + ', ' + accSectionField + ', ' + subQuery + 
                       ' FROM Account WHERE Type = \'Student\'';
        
        if (String.isNotBlank(className)) {
            query += ' AND ' + accClassField + ' INCLUDES (:className)';
        }
        
        if (String.isNotBlank(sectionName)) {
            query += ' AND ' + accSectionField + ' = :sectionName';
        }
        
        if (String.isNotBlank(searchTerm)) {
            String searchPattern = '%' + searchTerm + '%';
            query += ' AND (Name LIKE :searchPattern OR ' + accRollField + ' LIKE :searchPattern)';
        }
        
        query += ' ORDER BY Name';
        
        try {
            List<Account> students = Database.query(query);
            List<Map<String, Object>> results = new List<Map<String, Object>>();
            
            for (Account s : students) {
                Map<String, Object> row = new Map<String, Object>();
                row.put('Id', s.Id);
                row.put('StudentId', s.Id);
                row.put('Name', s.Name);
                row.put('Roll_No__c', (String)s.get(accRollField));
                row.put('Class__c', (String)s.get(accClassField));
                row.put('Section__c', (String)s.get(accSectionField));
                
                // Find matching exam for the selected type
                Exam__c matchingExam = null;
                List<Exam__c> relatedExams = (List<Exam__c>)s.getSObjects(examsRelName);
                if (relatedExams != null && !relatedExams.isEmpty()) {
                    matchingExam = relatedExams[0];
                }
                
                row.put('Exam_Type__c', matchingExam != null ? matchingExam.Exam_Type__c : (String.isNotBlank(examType) ? examType : 'All Tests'));
                
                for (String f : subjectFields) {
                    Object val = (matchingExam != null) ? matchingExam.get(f) : null;
                    String localFieldName = f;
                    
                    // Forcefully strip namespace if present (e.g. EduTrack__English__c -> English__c)
                    if (f.contains('__') && f.indexOf('__') != f.lastIndexOf('__')) {
                        localFieldName = f.substring(f.indexOf('__') + 2);
                    }
                    
                    if (val == null) {
                        row.put(localFieldName, 0); 
                    } else if (val instanceof String) {
                        try { 
                            row.put(localFieldName, Decimal.valueOf((String)val)); 
                        } catch (Exception ex) { 
                            row.put(localFieldName, 0); 
                        }
                    } else {
                        row.put(localFieldName, val);
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
            List<String> subjectFields = new List<String>();
            Map<String, String> fieldToLocalMap = new Map<String, String>();
            Map<String, Schema.SObjectField> fields = Schema.SObjectType.Exam__c.fields.getMap();
            Set<String> excluded = new Set<String>{'Exam_Type__c', 'Roll_Number__c', 'Section__c', 'Class__c', 'Student__c', 'Name', 'Id', 'CreatedDate', 'LastModifiedDate', 'SystemModstamp'};

            for (String fieldName : fields.keySet()) {
                Schema.DescribeFieldResult dfr = fields.get(fieldName).getDescribe();
                if (dfr.isCustom() && !excluded.contains(dfr.getName()) && !excluded.contains(dfr.getLocalName())) {
                    Schema.DisplayType dt = dfr.getType();
                    if (dt == Schema.DisplayType.Double || dt == Schema.DisplayType.Integer || dt == Schema.DisplayType.Percent || dt == Schema.DisplayType.String) {
                        subjectFields.add(dfr.getName());
                        fieldToLocalMap.put(dfr.getName(), dfr.getLocalName());
                    }
                }
            }

            // Resolve namespaced fields for Exam__c
            String examTypeField = Exam__c.Exam_Type__c.getDescribe().getName();
            String examClassField = Exam__c.Class__c.getDescribe().getName();
            String examSectionField = Exam__c.Section__c.getDescribe().getName();
            String examStudentField = Exam__c.Student__c.getDescribe().getName();

            String examSelect = subjectFields.isEmpty() ? 'Id' : String.join(subjectFields, ', ');
            String query = 'SELECT Id, ' + examTypeField + ', ' + examClassField + ', ' + examSectionField + ', ' + examSelect + 
                           ' FROM Exam__c WHERE ' + examStudentField + ' = :studentId ORDER BY CreatedDate DESC';
            
            List<Exam__c> exams = Database.query(query);
            List<Map<String, Object>> results = new List<Map<String, Object>>();
            
            for (Exam__c e : exams) {
                Map<String, Object> row = new Map<String, Object>();
                row.put('Id', e.Id);
                row.put('Exam_Type__c', (String)e.get(examTypeField));
                row.put('Section__c', (String)e.get(examSectionField));
                for (String f : subjectFields) {
                    Object val = e.get(f);
                    String localName = f;

                    // Forcefully strip namespace (e.g. EduTrack__Hindi__c -> Hindi__c)
                    if (f.contains('__') && f.indexOf('__') != f.lastIndexOf('__')) {
                        localName = f.substring(f.indexOf('__') + 2);
                    }

                    if (val instanceof String) {
                        try { row.put(localName, Decimal.valueOf((String)val)); } catch (Exception ex) { row.put(localName, 0); }
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