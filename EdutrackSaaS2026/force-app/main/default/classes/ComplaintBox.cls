public with sharing class ComplaintBox {
    
    @AuraEnabled
    public static Account getCurrentTeacher() {
        User u = (User)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name, Email
            FROM User
            WHERE Id = :UserInfo.getUserId()
             LIMIT 1]).getRecords()[0];

        List<Account> teachers = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name, PersonEmail
            FROM Account
            WHERE IsPersonAccount = true
            AND Type = 'Teacher'
            AND PersonEmail = :u.Email
             LIMIT 1]).getRecords();

        if (!teachers.isEmpty()) {
            return teachers[0];
        }

        throw new AuraHandledException('Teacher record not found for logged-in user');
    }

    // ✅ UPDATED: Get all classes from the Class__c object (lookup relationship)
    @AuraEnabled
    public static List<Map<String, String>> getStudentClasses() {
        try {
            // Query the Class__c object directly (since Class__c is now a lookup)
            // Adjust the API name below if your Class object is named differently
            List<Class__c> classRecords = (List<Class__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name FROM Class__c ORDER BY Name LIMIT 500]).getRecords();
            
            List<Map<String, String>> classList = new List<Map<String, String>>();
            for (SObject rec : classRecords) {
                Map<String, String> entry = new Map<String, String>();
                entry.put('value', (String) rec.get('Id'));
                entry.put('label', (String) rec.get('Name'));
                classList.add(entry);
            }
            
            if (classList.isEmpty()) {
                throw new AuraHandledException('No classes found. Please check the Class__c object has records.');
            }
            
            return classList;
            
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching classes: ' + e.getMessage());
        }
    }

    // ✅ Get all teachers
    @AuraEnabled
    public static List<Map<String, Object>> getTeachers() {
        try {
            List<Account> teachers = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name
                FROM Account
                WHERE IsPersonAccount = true
                AND Type = 'Teacher'
                 ORDER BY Name LIMIT 200]).getRecords();
            return NamespaceUtils.stripNamespaceList(teachers);
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching teachers: ' + e.getMessage());
        }
    }
    
    // ✅ UPDATED: Get students by class — Class__c is now a lookup (Id-based filter)
    @AuraEnabled(cacheable=false)
    public static List<Map<String, Object>> getStudentsByClass(String classId) {
        try {
            List<Account> students = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name, Class__c, Class__r.Name, PersonMobilePhone
                FROM Account 
                WHERE Class__c = :classId
                AND IsPersonAccount = true
                 ORDER BY Name LIMIT 100]).getRecords();
            
            return NamespaceUtils.stripNamespaceList(students);
            
        } catch (Exception e) {
            throw new AuraHandledException('Error: ' + e.getMessage());
        }
    }
    
    // ✅ UPDATED: Search students — Class__c is now a lookup (Id-based filter)
    @AuraEnabled(cacheable=false)
    public static List<Map<String, Object>> searchStudents(String searchKey, String selectedClassId) {
        try {
            String searchPattern = '%' + searchKey + '%';
            List<Account> results;
            if (String.isNotBlank(selectedClassId)) {
                results = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name, Class__c, Class__r.Name, PersonMobilePhone, Roll_No__c 
                            FROM Account 
                            WHERE IsPersonAccount = true 
                            AND (Name LIKE :searchPattern OR PersonMobilePhone LIKE :searchPattern OR Roll_No__c LIKE :searchPattern)
                            AND Class__c = :selectedClassId
                            ORDER BY Name LIMIT 20]).getRecords();
            } else {
                results = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name, Class__c, Class__r.Name, PersonMobilePhone, Roll_No__c 
                            FROM Account 
                            WHERE IsPersonAccount = true 
                            AND (Name LIKE :searchPattern OR PersonMobilePhone LIKE :searchPattern OR Roll_No__c LIKE :searchPattern)
                            ORDER BY Name LIMIT 20]).getRecords();
            }
            return NamespaceUtils.stripNamespaceList(results);
            
        } catch (Exception e) {
            throw new AuraHandledException('Error searching students: ' + e.getMessage());
        }
    }
    
    // Submit student behavior
    @AuraEnabled
    public static String submitStudentBehavior(
        String studentId,
        String behaviorType,
        String category,
        String description,
        String academicYear,
        String teacherId
    ) {
        try {
            Account student = (Account)Security.stripInaccessible(AccessType.READABLE, [SELECT Name, PersonContactId, Class__c, Class__r.Name
                FROM Account
                WHERE Id = :studentId
                 LIMIT 1]).getRecords()[0];

            Case studentCase = new Case();
            studentCase.AccountId = studentId;
            studentCase.ContactId = student.PersonContactId;
            studentCase.Subject = behaviorType + ' - ' + category + ' - ' + student.Name;
            studentCase.Description = description;
            studentCase.Origin = 'Internal';
            studentCase.Status = 'New';
            studentCase.Priority = (behaviorType == 'Complaint') ? 'High' : 'Medium';
            studentCase.Type = 'Student Behavior';

            if (String.isNotBlank(teacherId)) {
                studentCase.Submitted_By__c = teacherId;
            }

            String clsName = (String)NamespaceUtils.getValue(student, 'Class__r.Name');
            studentCase.Comments =
                'Academic Year: ' + academicYear + '\n' +
                'Behavior Type: ' + behaviorType + '\n' +
                'Category: ' + category + '\n' +
                'Class: ' + (clsName != null ? clsName : 'N/A') + '\n' +
                'Description: ' + description;

            if (!Schema.sObjectType.Case.isCreateable()) {
                throw new AuraHandledException('Insufficient permissions to create cases.');
            }
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, new List<Case>{studentCase});
            insert decision.getRecords();
            Id caseId = decision.getRecords()[0].Id;

            try {
                Case caseToUpdate = (Case)Security.stripInaccessible(AccessType.READABLE, [SELECT Id FROM Case WHERE Id = :caseId LIMIT 1]).getRecords()[0];
                caseToUpdate.Behavior_Type__c = behaviorType;
                caseToUpdate.Category__c = category;
                caseToUpdate.Academic_Year__c = academicYear;
                if (!Schema.sObjectType.Case.isUpdateable()) {
                    throw new AuraHandledException('Insufficient permissions to update cases.');
                }
                SObjectAccessDecision decisionUpdate = Security.stripInaccessible(AccessType.UPDATABLE, new List<Case>{caseToUpdate});
                update decisionUpdate.getRecords();
            } catch (Exception fieldError) { System.debug('ComplaintBox fieldError: ' + fieldError.getMessage()); }

            return caseId;

        } catch (Exception e) {
            throw new AuraHandledException('Error submitting behavior: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static List<String> getAcademicYears() {
        try {
            Integer currentYear = Date.today().year();
            List<String> years = new List<String>();
            for (Integer i = 0; i < 5; i++) {
                Integer startYear = currentYear - i;
                years.add(startYear + '-' + (startYear + 1));
            }
            return years;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching academic years: ' + e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=false)
    public static Map<String, Object> debugData() {
        Map<String, Object> debugInfo = new Map<String, Object>();
        try {
            User currentUser = (User)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name, ContactId, Profile.Name 
                FROM User 
                WHERE Id = :UserInfo.getUserId()
                ]).getRecords()[0];
            debugInfo.put('userId', currentUser.Id);
            debugInfo.put('userName', currentUser.Name);
            debugInfo.put('contactId', currentUser.ContactId);
            debugInfo.put('profileName', currentUser.Profile.Name);

            Integer totalStudents = [SELECT COUNT() FROM Account WHERE IsPersonAccount = true WITH SECURITY_ENFORCED];
            debugInfo.put('totalStudents', totalStudents);

            // ✅ UPDATED: Sample classes via lookup relationship
            Set<String> sampleClasses = new Set<String>();
            for (Account acc : (List<Account>)Security.stripInaccessible(AccessType.READABLE, [SELECT Class__r.Name 
                FROM Account 
                WHERE IsPersonAccount = true
                AND Class__c != null
                 LIMIT 10]).getRecords()) {
                String clsName = (String)NamespaceUtils.getValue(acc, 'Class__r.Name');
                if (clsName != null) sampleClasses.add(clsName);
            }
            debugInfo.put('sampleClasses', new List<String>(sampleClasses));

            try {
                Schema.DescribeFieldResult fieldResult = Account.Class__c.getDescribe();
                debugInfo.put('classFieldExists', true);
                debugInfo.put('classFieldType', String.valueOf(fieldResult.getType()));
            } catch (Exception e) {
                debugInfo.put('classFieldExists', false);
                debugInfo.put('classFieldError', e.getMessage());
            }
            
        } catch (Exception e) {
            debugInfo.put('error', e.getMessage());
        }
        return debugInfo;
    }
    
    @AuraEnabled
    public static List<Map<String, Object>> getPendingCases(String filterClass, String academicYear) {
        try {
            List<Case> results;
            if (String.isNotBlank(filterClass)) {
                results = (List<Case>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Subject, Description, Status, Priority, CreatedDate, 
                            CaseNumber, Account.Name, Account.Class__r.Name, Owner.Name 
                            FROM Case 
                            WHERE Type = 'Student Behavior' 
                            AND Status != 'Closed'
                            AND Account.Class__c = :filterClass
                            ORDER BY CreatedDate DESC LIMIT 50]).getRecords();
            } else {
                results = (List<Case>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Subject, Description, Status, Priority, CreatedDate, 
                            CaseNumber, Account.Name, Account.Class__r.Name, Owner.Name 
                            FROM Case 
                            WHERE Type = 'Student Behavior' 
                            AND Status != 'Closed'
                            ORDER BY CreatedDate DESC LIMIT 50]).getRecords();
            }
            return NamespaceUtils.stripNamespaceList(results);
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching pending cases: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static List<Map<String, Object>> getStudentCases(String studentId, String academicYear) {
        try {
            List<Case> results;
            if (String.isNotBlank(academicYear)) {
                results = (List<Case>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Subject, Description, Status, Priority, CreatedDate, 
                            CaseNumber, Behavior_Type__c, Category__c, Academic_Year__c, Owner.Name 
                            FROM Case 
                            WHERE Type = 'Student Behavior' 
                            AND AccountId = :studentId
                            AND Academic_Year__c = :academicYear
                            ORDER BY CreatedDate DESC
                            LIMIT 1000]).getRecords();
            } else {
                results = (List<Case>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Subject, Description, Status, Priority, CreatedDate, 
                            CaseNumber, Behavior_Type__c, Category__c, Academic_Year__c, Owner.Name 
                            FROM Case 
                            WHERE Type = 'Student Behavior' 
                            AND AccountId = :studentId
                            ORDER BY CreatedDate DESC
                            LIMIT 1000]).getRecords();
            }
            return NamespaceUtils.stripNamespaceList(results);
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching student cases: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static void updateCaseStatus(String caseId, String status) {
        try {
            Case c = (Case)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Status FROM Case WHERE Id = :caseId LIMIT 1]).getRecords()[0];
            c.Status = status;
            if (!Schema.sObjectType.Case.isUpdateable()) {
                throw new AuraHandledException('Insufficient permissions to update cases.');
            }
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, new List<Case>{c});
            update decision.getRecords();
        } catch (Exception e) {
            throw new AuraHandledException('Error updating case: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static Map<String, Integer> getStudentStats(String studentId, String academicYear) {
        Map<String, Integer> stats = new Map<String, Integer>{
            'totalCases' => 0,
            'complaints' => 0,
            'praises'    => 0,
            'resolved'   => 0
        };

        try {
            List<Case> caseList = (List<Case>)Security.stripInaccessible(AccessType.READABLE, [SELECT Status, Type
                FROM Case
                WHERE Type = 'Student Behavior'
                AND AccountId = :studentId
                LIMIT 1000
                ]).getRecords();

            for (Case c : caseList) {
                stats.put('totalCases', stats.get('totalCases') + 1);
                if (c.Type == 'Complaint') stats.put('complaints', stats.get('complaints') + 1);
                else if (c.Type == 'Praise') stats.put('praises', stats.get('praises') + 1);
                if (c.Status == 'Closed') stats.put('resolved', stats.get('resolved') + 1);
            }
            
            return stats;
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching student stats: ' + e.getMessage());
        }
    } 
}








