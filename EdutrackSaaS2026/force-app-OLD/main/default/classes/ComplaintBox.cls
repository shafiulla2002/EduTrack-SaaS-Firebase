public without sharing class ComplaintBox {
    
    @AuraEnabled
    public static Account getCurrentTeacher() {
        System.debug('=== getCurrentTeacher START ===');
        
        User u = [
            SELECT Id, Name, Email
            FROM User
            WHERE Id = :UserInfo.getUserId()
            LIMIT 1
        ];
        
        System.debug('Current User: ' + u.Name + ' (' + u.Email + ')');

        List<Account> teachers = [
            SELECT Id, Name, PersonEmail
            FROM Account
            WHERE IsPersonAccount = true
            AND Type = 'Teacher'
            AND PersonEmail = :u.Email
            LIMIT 1
        ];

        if (!teachers.isEmpty()) {
            System.debug('Teacher found: ' + teachers[0].Name);
            return teachers[0];
        }

        System.debug('ERROR: Teacher record not found');
        throw new AuraHandledException('Teacher record not found for logged-in user');
    }

    // ✅ UPDATED: Get all classes from the Class__c object (lookup relationship)
    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getStudentClasses() {
        System.debug('=== getStudentClasses START ===');
        
        try {
            // Query the Class__c object directly (since Class__c is now a lookup)
            // Adjust the API name below if your Class object is named differently
            List<SObject> classRecords = Database.query(
                'SELECT Id, Name FROM Class__c ORDER BY Name LIMIT 500'
            );
            
            List<Map<String, String>> classList = new List<Map<String, String>>();
            for (SObject rec : classRecords) {
                Map<String, String> entry = new Map<String, String>();
                entry.put('value', (String) rec.get('Id'));
                entry.put('label', (String) rec.get('Name'));
                classList.add(entry);
            }
            
            System.debug('Classes found: ' + classList.size());
            
            if (classList.isEmpty()) {
                System.debug('WARNING: No classes found in Class__c object!');
                throw new AuraHandledException('No classes found. Please check the Class__c object has records.');
            }
            
            return classList;
            
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            System.debug('ERROR in getStudentClasses: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Error fetching classes: ' + e.getMessage());
        }
    }

    // ✅ Get all teachers
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getTeachers() {
        System.debug('=== getTeachers START ===');
        try {
            List<Account> teachers = [
                SELECT Id, Name
                FROM Account
                WHERE IsPersonAccount = true
                AND Type = 'Teacher'
                ORDER BY Name
                LIMIT 200
            ];
            System.debug('Teachers found: ' + teachers.size());
            return NamespaceUtils.stripNamespaceList(teachers);
        } catch (Exception e) {
            System.debug('ERROR in getTeachers: ' + e.getMessage());
            throw new AuraHandledException('Error fetching teachers: ' + e.getMessage());
        }
    }
    
    // ✅ UPDATED: Get students by class — Class__c is now a lookup (Id-based filter)
    @AuraEnabled(cacheable=false)
    public static List<Map<String, Object>> getStudentsByClass(String classId) {
        System.debug('=== getStudentsByClass START ===');
        System.debug('Class Id: ' + classId);
        
        try {
            List<Account> students = [
                SELECT Id, Name, Class__c, Class__r.Name, PersonMobilePhone
                FROM Account 
                WHERE Class__c = :classId
                AND IsPersonAccount = true
                ORDER BY Name 
                LIMIT 100
            ];
            
            System.debug('Students found: ' + students.size());
            for (Account s : students) {
                System.debug('Student: ' + s.Name + ' - Class: ' + s.Class__r.Name);
            }
            
            return NamespaceUtils.stripNamespaceList(students);
            
        } catch (Exception e) {
            System.debug('ERROR: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Error: ' + e.getMessage());
        }
    }
    
    // ✅ UPDATED: Search students — Class__c is now a lookup (Id-based filter)
    @AuraEnabled(cacheable=false)
    public static List<Map<String, Object>> searchStudents(String searchKey, String selectedClassId) {
        System.debug('=== searchStudents START ===');
        System.debug('Search key: ' + searchKey);
        System.debug('Selected class Id: ' + selectedClassId);
        
        try {
            String searchPattern = '%' + searchKey + '%';

            String query = 'SELECT Id, Name, Class__c, Class__r.Name, PersonMobilePhone, Student_ID__c ' +
                           'FROM Account ' +
                           'WHERE IsPersonAccount = true ' +
                           'AND (Name LIKE :searchPattern ' +
                           'OR PersonMobilePhone LIKE :searchPattern ' +
                           'OR Student_ID__c LIKE :searchPattern) ';

            if (String.isNotBlank(selectedClassId)) {
                query += 'AND Class__c = :selectedClassId ';
            }

            query += 'ORDER BY Name LIMIT 20';

            List<Account> results = Database.query(query);
            System.debug('Search results count: ' + results.size());
            return NamespaceUtils.stripNamespaceList(results);
            
        } catch (Exception e) {
            System.debug('ERROR in searchStudents: ' + e.getMessage());
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
        System.debug('=== submitStudentBehavior START ===');
        System.debug('Student ID: ' + studentId);
        System.debug('Behavior Type: ' + behaviorType);
        System.debug('Category: ' + category);
        System.debug('Teacher ID: ' + teacherId);

        try {
            Account student = [
                SELECT Name, PersonContactId, Class__c, Class__r.Name
                FROM Account
                WHERE Id = :studentId
                LIMIT 1
            ];

            System.debug('Student found: ' + student.Name);

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

            studentCase.Comments =
                'Academic Year: ' + academicYear + '\n' +
                'Behavior Type: ' + behaviorType + '\n' +
                'Category: ' + category + '\n' +
                'Class: ' + student.Class__r.Name + '\n' +
                'Description: ' + description;

            insert studentCase;
            System.debug('Case created: ' + studentCase.Id);

            try {
                Case caseToUpdate = new Case(Id = studentCase.Id);
                caseToUpdate.put('Behavior_Type__c', behaviorType);
                caseToUpdate.put('Category__c', category);
                caseToUpdate.put('Academic_Year__c', academicYear);
                update caseToUpdate;
                System.debug('Custom fields updated');
            } catch (Exception fieldError) {
                System.debug('Custom fields not available: ' + fieldError.getMessage());
            }

            return studentCase.Id;

        } catch (Exception e) {
            System.debug('ERROR submitting behavior: ' + e.getMessage());
            throw new AuraHandledException('Error submitting behavior: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<String> getAcademicYears() {
        System.debug('=== getAcademicYears START ===');
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
        System.debug('=== debugData START ===');
        Map<String, Object> debugInfo = new Map<String, Object>();
        try {
            User currentUser = [
                SELECT Id, Name, ContactId, Profile.Name 
                FROM User 
                WHERE Id = :UserInfo.getUserId()
            ];
            debugInfo.put('userId', currentUser.Id);
            debugInfo.put('userName', currentUser.Name);
            debugInfo.put('contactId', currentUser.ContactId);
            debugInfo.put('profileName', currentUser.Profile.Name);

            Integer totalStudents = [SELECT COUNT() FROM Account WHERE IsPersonAccount = true];
            debugInfo.put('totalStudents', totalStudents);

            // ✅ UPDATED: Sample classes via lookup relationship
            Set<String> sampleClasses = new Set<String>();
            for (Account acc : [
                SELECT Class__r.Name 
                FROM Account 
                WHERE IsPersonAccount = true
                AND Class__c != null 
                LIMIT 10
            ]) {
                if (acc.Class__r != null) sampleClasses.add(acc.Class__r.Name);
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
    
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getPendingCases(String filterClass, String academicYear) {
        System.debug('=== getPendingCases START ===');
        try {
            String baseQuery =
                'SELECT Id, Subject, Description, Status, Priority, CreatedDate, ' +
                'CaseNumber, Account.Name, Account.Class__r.Name, Owner.Name ' +
                'FROM Case ' +
                'WHERE Type = \'Student Behavior\' ' +
                'AND Status != \'Closed\' ';

            // filterClass is now a Class Id (lookup)
            if (String.isNotBlank(filterClass)) {
                baseQuery += 'AND Account.Class__c = :filterClass ';
            }

            baseQuery += 'ORDER BY CreatedDate DESC LIMIT 50';
            List<Case> results = Database.query(baseQuery);
            System.debug('Pending cases found: ' + results.size());
            return NamespaceUtils.stripNamespaceList(results);
            
        } catch (Exception e) {
            System.debug('ERROR in getPendingCases: ' + e.getMessage());
            throw new AuraHandledException('Error fetching pending cases: ' + e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getStudentCases(String studentId, String academicYear) {
        System.debug('=== getStudentCases START ===');
        try {
            String query =
                'SELECT Id, Subject, Description, Status, Priority, CreatedDate, ' +
                'CaseNumber, Behavior_Type__c, Category__c, Academic_Year__c, Owner.Name ' +
                'FROM Case ' +
                'WHERE Type = \'Student Behavior\' ' +
                'AND AccountId = :studentId ';

            if (String.isNotBlank(academicYear)) {
                query += 'AND Academic_Year__c = :academicYear ';
            }

            query += 'ORDER BY CreatedDate DESC';
            List<Case> results = Database.query(query);
            System.debug('Student cases found: ' + results.size());
            return NamespaceUtils.stripNamespaceList(results);
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching student cases: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static void updateCaseStatus(String caseId, String status) {
        System.debug('=== updateCaseStatus START ===');
        try {
            Case c = [SELECT Id, Status FROM Case WHERE Id = :caseId LIMIT 1];
            c.Status = status;
            update c;
            System.debug('Case updated successfully');
        } catch (Exception e) {
            throw new AuraHandledException('Error updating case: ' + e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Integer> getStudentStats(String studentId, String academicYear) {
        System.debug('=== getStudentStats START ===');

        Map<String, Integer> stats = new Map<String, Integer>{
            'totalCases' => 0,
            'complaints' => 0,
            'praises'    => 0,
            'resolved'   => 0
        };

        try {
            List<Case> caseList = [
                SELECT Status, Type
                FROM Case
                WHERE Type = 'Student Behavior'
                AND AccountId = :studentId
            ];

            for (Case c : caseList) {
                stats.put('totalCases', stats.get('totalCases') + 1);
                if (c.Type == 'Complaint') stats.put('complaints', stats.get('complaints') + 1);
                else if (c.Type == 'Praise') stats.put('praises', stats.get('praises') + 1);
                if (c.Status == 'Closed') stats.put('resolved', stats.get('resolved') + 1);
            }
            
            System.debug('Stats: ' + stats);
            return stats;
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching student stats: ' + e.getMessage());
        }
    } 
}