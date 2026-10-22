public without sharing class ComplaintBox {
    
    // Get current teacher details
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

        // Find Teacher Person Account by Email
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

    // Get all classes
    @AuraEnabled(cacheable=true)
    public static List<String> getStudentClasses() {
        System.debug('=== getStudentClasses START ===');
        
        try {
            Set<String> uniqueClasses = new Set<String>();
            
            // Get picklist values from Current_Class__c field
            try {
                System.debug('Attempting to fetch picklist values...');
                Schema.DescribeFieldResult fieldResult = Account.Class__c.getDescribe();
                List<Schema.PicklistEntry> picklistValues = fieldResult.getPicklistValues();
                
                System.debug('Picklist entries found: ' + picklistValues.size());
                
                for (Schema.PicklistEntry entry : picklistValues) {
                    if (entry.isActive()) {
                        uniqueClasses.add(entry.getLabel());
                        System.debug('Added picklist value: ' + entry.getLabel());
                    }
                }
                
                System.debug('Picklist classes found: ' + uniqueClasses);
            } catch (Exception e) {
                System.debug('Picklist field error: ' + e.getMessage());
                System.debug('Stack trace: ' + e.getStackTraceString());
            }
            
            // Always also get classes from actual records
            System.debug('Fetching classes from student records...');
            List<Account> students = [
                SELECT Class__c 
                FROM Account 
                WHERE IsPersonAccount = true
                AND Class__c != null 
                LIMIT 1000
            ];
            
            System.debug('Student records found: ' + students.size());
            
            for (Account student : students) {
                if (String.isNotBlank(student.Class__c)) {
                    uniqueClasses.add(student.Class__c);
                }
            }
            
            List<String> classList = new List<String>(uniqueClasses);
            classList.sort();
            
            System.debug('Final classes returned: ' + classList);
            System.debug('Total classes found: ' + classList.size());
            
            if (classList.isEmpty()) {
                System.debug('WARNING: No classes found!');
                throw new AuraHandledException('No classes found. Please check if Current_Class__c picklist has values or if students have class assignments.');
            }
            
            return classList;
            
        } catch (Exception e) {
            System.debug('ERROR in getStudentClasses: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Error fetching classes: ' + e.getMessage());
        }
    }
    // ✅ NEW: Get all teachers
@AuraEnabled(cacheable=true)
public static List<Account> getTeachers() {
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
        return teachers;
    } catch (Exception e) {
        System.debug('ERROR in getTeachers: ' + e.getMessage());
        throw new AuraHandledException('Error fetching teachers: ' + e.getMessage());
    }
}
    
    // Get students by class
    @AuraEnabled(cacheable=false)
    public static List<Account> getStudentsByClass(String className) {
        System.debug('=== getStudentsByClass START ===');
        System.debug('Class name: ' + className);
        
        try {
            List<Account> students = [
                SELECT Id, Name, Class__c, PersonMobilePhone
                FROM Account 
                WHERE Class__c = :className 
                AND IsPersonAccount = true
                ORDER BY Name 
                LIMIT 100
            ];
            
            System.debug('Students found: ' + students.size());
            for (Account s : students) {
                System.debug('Student: ' + s.Name + ' - Class: ' + s.Class__c);
            }
            
            return students;
            
        } catch (Exception e) {
            System.debug('ERROR: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Error: ' + e.getMessage());
        }
    }
    
    // Search students
    @AuraEnabled(cacheable=false)
    public static List<Account> searchStudents(String searchKey, String selectedClass) {
        System.debug('=== searchStudents START ===');
        System.debug('Search key: ' + searchKey);
        System.debug('Selected class: ' + selectedClass);
        
        try {
            String searchPattern = '%' + searchKey + '%';
            System.debug('Search pattern: ' + searchPattern);

            String query = 'SELECT Id, Name, Class__c, PersonMobilePhone, Student_ID__c ' +
                           'FROM Account ' +
                           'WHERE IsPersonAccount = true ' +
                           'AND (Name LIKE :searchPattern ' +
                           'OR PersonMobilePhone LIKE :searchPattern ' +
                           'OR Student_ID__c LIKE :searchPattern) ';

            if (String.isNotBlank(selectedClass)) {
                query += 'AND Class__c = :selectedClass ';
                System.debug('Class filter applied: ' + selectedClass);
            }

            query += 'ORDER BY Name LIMIT 20';
            
            System.debug('Final query: ' + query);

            List<Account> results = Database.query(query);
            
            System.debug('Search results count: ' + results.size());
            for (Account a : results) {
                System.debug('Result: ' + a.Name + ' - Class: ' + a.Class__c + ' - Phone: ' + a.PersonMobilePhone );
            }
            
            return results;
            
        } catch (Exception e) {
            System.debug('ERROR in searchStudents: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
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
    String teacherId       // ✅ NEW parameter
) {
    System.debug('=== submitStudentBehavior START ===');
    System.debug('Student ID: ' + studentId);
    System.debug('Behavior Type: ' + behaviorType);
    System.debug('Category: ' + category);
    System.debug('Teacher ID: ' + teacherId); // ✅ NEW

    try {
        Account student = [
            SELECT Name, PersonContactId, Class__c
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

        // ✅ NEW: Set the Submitted_By__c lookup to the selected teacher
        if (String.isNotBlank(teacherId)) {
            studentCase.Submitted_By__c = teacherId;
        }

        studentCase.Comments =
            'Academic Year: ' + academicYear + '\n' +
            'Behavior Type: ' + behaviorType + '\n' +
            'Category: ' + category + '\n' +
            'Class: ' + student.Class__c + '\n' +
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
        System.debug('Stack trace: ' + e.getStackTraceString());
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
                String yearStr = startYear + '-' + (startYear + 1);
                years.add(yearStr);
                System.debug('Year added: ' + yearStr);
            }
            
            System.debug('Total years: ' + years.size());
            return years;
            
        } catch (Exception e) {
            System.debug('ERROR: ' + e.getMessage());
            throw new AuraHandledException('Error fetching academic years: ' + e.getMessage());
        }
    }
    
    // Debug helper method
    @AuraEnabled(cacheable=false)
    public static Map<String, Object> debugData() {
        System.debug('=== debugData START ===');
        
        Map<String, Object> debugInfo = new Map<String, Object>();
        
        try {
            // Check current user
            User currentUser = [
                SELECT Id, Name, ContactId, Profile.Name 
                FROM User 
                WHERE Id = :UserInfo.getUserId()
            ];
            
            debugInfo.put('userId', currentUser.Id);
            debugInfo.put('userName', currentUser.Name);
            debugInfo.put('contactId', currentUser.ContactId);
            debugInfo.put('profileName', currentUser.Profile.Name);
            
            System.debug('User info: ' + debugInfo);
            
            // Count students
            Integer totalStudents = [SELECT COUNT() FROM Account WHERE IsPersonAccount = true];
            debugInfo.put('totalStudents', totalStudents);
            System.debug('Total students: ' + totalStudents);
            
            // Sample classes
            Set<String> sampleClasses = new Set<String>();
            for (Account acc : [
                SELECT Class__c 
                FROM Account 
                WHERE IsPersonAccount = true
                AND Class__c != null 
                LIMIT 10
            ]) {
                sampleClasses.add(acc.Class__c);
            }
            debugInfo.put('sampleClasses', new List<String>(sampleClasses));
            System.debug('Sample classes: ' + sampleClasses);
            
            // Check if Class__c field exists
            try {
                Schema.DescribeFieldResult fieldResult = Account.Class__c.getDescribe();
                debugInfo.put('classFieldExists', true);
                debugInfo.put('classFieldType', String.valueOf(fieldResult.getType()));
                System.debug('Field type: ' + fieldResult.getType());
            } catch (Exception e) {
                debugInfo.put('classFieldExists', false);
                debugInfo.put('classFieldError', e.getMessage());
                System.debug('Field error: ' + e.getMessage());
            }
            
        } catch (Exception e) {
            debugInfo.put('error', e.getMessage());
            System.debug('ERROR in debugData: ' + e.getMessage());
        }
        
        System.debug('Debug info: ' + debugInfo);
        return debugInfo;
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Case> getPendingCases(
        String filterClass,
        String academicYear
    ) {
        System.debug('=== getPendingCases START ===');
        System.debug('Filter class: ' + filterClass);
        System.debug('Academic year: ' + academicYear);
        
        try {
            String baseQuery =
                'SELECT Id, Subject, Description, Status, Priority, CreatedDate, ' +
                'CaseNumber, Account.Name, Account.Class__c, Owner.Name ' +
                'FROM Case ' +
                'WHERE Type = \'Student Behavior\' ' +
                'AND Status != \'Closed\' ';

            if (String.isNotBlank(filterClass)) {
                baseQuery += 'AND Account.Class__c = :filterClass ';
                System.debug('Class filter applied');
            }

            /*
            if (String.isNotBlank(academicYear)) {
                baseQuery += 'AND Academic_Year__c = :academicYear ';
                System.debug('Year filter applied');
            }
            */

            baseQuery += 'ORDER BY CreatedDate DESC LIMIT 50';
            
            System.debug('Query: ' + baseQuery);

            List<Case> results = Database.query(baseQuery);
            
            System.debug('Pending cases found: ' + results.size());
            for (Case c : results) {
                System.debug('Case: ' + c.Subject + ' - Student: ' + c.Account.Name + ' - Class: ' + c.Account.Class__c);
            }
            
            return results;
            
        } catch (Exception e) {
            System.debug('ERROR in getPendingCases: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Error fetching pending cases: ' + e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Case> getStudentCases(String studentId, String academicYear) {
        System.debug('=== getStudentCases START ===');
        System.debug('Student ID: ' + studentId);
        System.debug('Academic year: ' + academicYear);
        
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
            
            System.debug('Query: ' + query);

            List<Case> results = Database.query(query);
            
            System.debug('Student cases found: ' + results.size());
            return results;
            
        } catch (Exception e) {
            System.debug('ERROR in getStudentCases: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Error fetching student cases: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static void updateCaseStatus(String caseId, String status) {
        System.debug('=== updateCaseStatus START ===');
        System.debug('Case ID: ' + caseId);
        System.debug('New status: ' + status);
        
        try {
            Case c = [
                SELECT Id, Status
                FROM Case
                WHERE Id = :caseId
                LIMIT 1
            ];
            
            System.debug('Old status: ' + c.Status);

            c.Status = status;
            update c;
            
            System.debug('Case updated successfully');
            
        } catch (Exception e) {
            System.debug('ERROR updating case: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Error updating case: ' + e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Integer> getStudentStats(
        String studentId,
        String academicYear
    ) {
        System.debug('=== getStudentStats START ===');
        System.debug('Student ID: ' + studentId);
        System.debug('Academic year: ' + academicYear);

        Map<String, Integer> stats = new Map<String, Integer>{
            'totalCases' => 0,
            'complaints' => 0,
            'praises'    => 0,
            'resolved'   => 0
        };

        try {
            List<Case> caseList;

            if (String.isBlank(academicYear)) {
                caseList = [
                    SELECT Status, Type
                    FROM Case
                    WHERE Type = 'Student Behavior'
                    AND AccountId = :studentId
                ];
            } else {
                caseList = [
                    SELECT Status, Type
                    FROM Case
                    WHERE Type = 'Student Behavior'
                    AND AccountId = :studentId
                    //AND Academic_Year__c = :academicYear
                ];
            }
            
            System.debug('Cases found: ' + caseList.size());

            for (Case c : caseList) {
                stats.put('totalCases', stats.get('totalCases') + 1);

                if (c.Type == 'Complaint') {
                    stats.put('complaints', stats.get('complaints') + 1);
                } else if (c.Type == 'Praise') {
                    stats.put('praises', stats.get('praises') + 1);
                }

                if (c.Status == 'Closed') {
                    stats.put('resolved', stats.get('resolved') + 1);
                }
            }
            
            System.debug('Stats calculated: ' + stats);
            return stats;
            
        } catch (Exception e) {
            System.debug('ERROR in getStudentStats: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Error fetching student stats: ' + e.getMessage());
        }
    }
}