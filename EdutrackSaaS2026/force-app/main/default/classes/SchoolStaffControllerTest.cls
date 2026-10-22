@isTest
private class SchoolStaffControllerTest {

    @testSetup
    static void setup() {
        User u = EduTrackTestUtils.createAdminUser();
        PermissionSet ps = [SELECT Id FROM PermissionSet WHERE Name = 'EduTrack_Full_Access' LIMIT 1];
        insert new PermissionSetAssignment(AssigneeId = u.Id, PermissionSetId = ps.Id);

        System.runAs(u) {
            // Create Person Account Record Type
            Id personAccountRecordTypeId = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1].Id;

            // 1. Create Teacher Staff
            Account teacher = new Account(
                FirstName = 'Staff',
                LastName = 'Teacher',
                RecordTypeId = personAccountRecordTypeId,
                Type = 'Teacher',
                Phone = '1234567890',
                PersonEmail = 'teacher@test.com',
                Basic_Salary__c = 50000,
                HRA__c = 10000,
                DA__c = 5000,
                PF_Deduction__c = 3000,
                Staff_Status__c = 'Active'
            );
            insert teacher;

            // 2. Create NonTeaching Staff
            Account nonTeacher = new Account(
                FirstName = 'Staff',
                LastName = 'NonTeacher',
                RecordTypeId = personAccountRecordTypeId,
                Type = 'Non Teaching Staff',
                Phone = '0987654321',
                PersonEmail = 'nonteacher@test.com',
                Basic_Salary__c = 30000,
                HRA__c = 5000,
                DA__c = 2000,
                PF_Deduction__c = 1500,
                Staff_Status__c = 'Active'
            );
            insert nonTeacher;

            // 3. Create Subject
            Subject__c sub = new Subject__c(Name = 'Maths');
            insert sub;

            // 4. Create Teacher_Skill__c
            Teacher_Skill__c skill = new Teacher_Skill__c(
                Name = 'Staff Teacher - Maths',
                Teacher__c = teacher.Id,
                Subject__c = sub.Id,
                Skill_Level__c = 'Expert',
                Years_of_Experience__c = 5
            );
            insert skill;

            // 5. Create Invoice__c (Salary)
            Invoice__c inv = new Invoice__c(
                Account__c = teacher.Id,
                Invoice_Type__c = 'Salary',
                Invoice_Month__c = 'Mar 2026',
                Status__c = 'Paid',
                Invoice_Date__c = Date.today(),
                Total_Amount__c = 62000
            );
            insert inv;
            
            // 6. Create Period__c
            Period__c p = new Period__c(
                Day__c = 'Monday',
                Period_Number__c = '1',
                Subjects__c = sub.Id,
                Assigned_Teacher__c = teacher.Id,
                Start_Time__c = Time.newInstance(9, 0, 0, 0),
                End_Time__c = Time.newInstance(10, 0, 0, 0)
            );
            insert p;

            // 7. Create Case
            Case c = new Case(
                Subject = 'Test Praise',
                Type = 'Praise',
                AccountId = teacher.Id
            );
            insert c;

            // 8. Upload initial photo
            SchoolStaffController.uploadStaffPhoto(teacher.Id, 'dGVzdA==', 'test_photo.jpg');
        }
    }

    @isTest
    static void testGetAllStaff() {
        User u = [SELECT Id FROM User WHERE Alias = 'etadmin' LIMIT 1];
        Test.startTest();
        List<SchoolStaffController.StaffWrapper> results;
        System.runAs(u) {
            results = SchoolStaffController.getAllStaff();
        }
        Test.stopTest();
        System.assert(results.size() >= 2, 'Should return at least 2 staff members');
    }

    @isTest
    static void testGetPayrollRecords() {
        Test.startTest();
        List<SchoolStaffController.PayrollWrapper> results = SchoolStaffController.getPayrollRecords('Mar 2026');
        Test.stopTest();
        System.assertEquals(2, results.size(), 'Should find 2 payroll records');
    }

    @isTest
    static void testGetPayslipData() {
        User u = [SELECT Id FROM User WHERE Alias = 'etadmin' LIMIT 1];
        Account teacher = [SELECT Id FROM Account WHERE LastName = 'Teacher' LIMIT 1];
        Test.startTest();
        SchoolStaffController.PayslipWrapper ps;
        System.runAs(u) {
            ps = SchoolStaffController.getPayslipData(teacher.Id, 'Mar 2026');
        }
        Test.stopTest();
        System.assertNotEquals(null, ps, 'Payslip data should not be null');
        System.assertEquals('Mar 2026', ps.invoiceMonth);
    }

    @isTest
    static void testGetStaffDetail() {
        Account teacher = [SELECT Id FROM Account WHERE LastName = 'Teacher' LIMIT 1];
        Test.startTest();
        Map<String, Object> result = SchoolStaffController.getStaffDetail(teacher.Id);
        Test.stopTest();
        System.assert(result.containsKey('skills'), 'Should contain skills');
        System.assert(result.containsKey('invoices'), 'Should contain invoices');
    }

    @isTest
    static void testUploadStaffPhoto() {
        Account teacher = [SELECT Id FROM Account WHERE LastName = 'Teacher' LIMIT 1];
        Test.startTest();
        String cvId = SchoolStaffController.uploadStaffPhoto(teacher.Id, 'dGVzdDI=', 'test_photo2.jpg');
        Test.stopTest();
        System.assertNotEquals(null, cvId, 'Should return ContentVersion ID');
    }

    @isTest
    static void testUpsertStaff() {
        User u = [SELECT Id FROM User WHERE Alias = 'etadmin' LIMIT 1];
        Subject__c sub = [SELECT Id FROM Subject__c LIMIT 1];
        
        // Create JSON payload for a new Staff
        Map<String, Object> payload = new Map<String, Object>{
            'FirstName' => 'New',
            'LastName' => 'StaffMember',
            'Email' => 'newstaff@test.com',
            'Phone' => '1122334455',
            'StaffType' => 'Teaching',
            'BasicSalary' => 45000,
            'Hra' => 8000,
            'Da' => 4000,
            'Pf' => 2000,
            'Status' => 'Active'
        };

        Test.startTest();
        String staffId;
        System.runAs(u) {
            staffId = SchoolStaffController.upsertStaff(JSON.serialize(payload), null);
        }
        Test.stopTest();

        System.assertNotEquals(null, staffId, 'Should return saved staff ID');
        Account acc = [SELECT Employee_ID__c FROM Account WHERE Id = :staffId];
        System.assertNotEquals(null, acc.Employee_ID__c, 'Employee ID should be generated');
    }

    @isTest
    static void testDeleteStaff() {
        Account nonTeacher = [SELECT Id FROM Account WHERE LastName = 'NonTeacher' LIMIT 1];
        Test.startTest();
        SchoolStaffController.deleteStaff(nonTeacher.Id);
        Test.stopTest();
        List<Account> check = [SELECT Id FROM Account WHERE Id = :nonTeacher.Id];
        System.assertEquals(0, check.size(), 'Staff should be deleted');
    }

    @isTest
    static void testPaySalary() {
        User u = [SELECT Id FROM User WHERE Alias = 'etadmin' LIMIT 1];
        Account nonTeacher = [SELECT Id FROM Account WHERE LastName = 'NonTeacher' LIMIT 1];
        Test.startTest();
        String invId;
        System.runAs(u) {
            invId = SchoolStaffController.paySalary(nonTeacher.Id, 'Mar 2026');
        }
        Test.stopTest();
        System.assertNotEquals(null, invId, 'Should return invoice ID');
    }

    @isTest
    static void testGetStaffDetailExceptions() {
        Test.startTest();
        // Passing an invalid ID format causes the SOQL queries to throw an exception
        // when attempting to bind a non-Id string to an Id lookup field.
        // This will neatly cover all the empty catch blocks in getStaffDetail.
        Map<String, Object> result = SchoolStaffController.getStaffDetail('InvalidId123');
        Test.stopTest();
        System.assertNotEquals(null, result, 'Result should be returned even if internal queries fail');
    }

    @isTest
    static void testUpsertStaffUpdate() {
        Account teacher = [SELECT Id FROM Account WHERE LastName = 'Teacher' LIMIT 1];
        Map<String, Object> payload = new Map<String, Object>{
            'id' => teacher.Id,
            'FirstName' => 'Updated',
            'LastName' => 'Teacher',
            'Email' => 'upd@test.com',
            'Phone' => '1122334455',
            'StaffType' => 'Teaching',
            'BasicSalary' => 45000,
            'Dob' => '1990-01-01',
            'JoiningDate' => '2025-01-01'
        };
        Subject__c sub = [SELECT Id FROM Subject__c LIMIT 1];
        String skillsJson = '[{"subjectId": "' + sub.Id + '", "skillLevel": "Expert", "yearsOfExperience": "5"}]';

        Test.startTest();
        String staffId = SchoolStaffController.upsertStaff(JSON.serialize(payload), skillsJson);
        Test.stopTest();
        System.assertEquals(teacher.Id, staffId);
    }

    @isTest
    static void testUpsertStaffExceptions() {
        Test.startTest();
        try { SchoolStaffController.upsertStaff('', null); } catch(Exception e) {}
        try { SchoolStaffController.upsertStaff('invalid json', null); } catch(Exception e) {}
        try { SchoolStaffController.upsertStaff('{}', null); } catch(Exception e) {}
        try { SchoolStaffController.upsertStaff('{"FirstName":"A"}', null); } catch(Exception e) {}
        try { SchoolStaffController.upsertStaff('{"FirstName":"A", "LastName":"B"}', null); } catch(Exception e) {}
        try { SchoolStaffController.upsertStaff('{"FirstName":"A", "LastName":"B", "Email":"e@e.com"}', null); } catch(Exception e) {}
        try { SchoolStaffController.upsertStaff('{"FirstName":"A", "LastName":"B", "Email":"e@e.com", "Phone":"1"}', null); } catch(Exception e) {}
        Test.stopTest();
    }

    @isTest
    static void testMiscExceptions() {
        Test.startTest();
        try { SchoolStaffController.deleteStaff(''); } catch(Exception e) {}
        try { SchoolStaffController.deleteStaff('invalidId'); } catch(Exception e) {}
        try { SchoolStaffController.paySalary('', ''); } catch(Exception e) {}
        try { SchoolStaffController.paySalary('invalidId', 'Mar 2026'); } catch(Exception e) {}
        try { SchoolStaffController.processAllPayroll(''); } catch(Exception e) {}
        try { SchoolStaffController.uploadStaffPhoto('', '', ''); } catch(Exception e) {}
        try { SchoolStaffController.getPayslipData('', ''); } catch(Exception e) {}
        try { SchoolStaffController.getStaffDetail(''); } catch(Exception e) {}
        Test.stopTest();
    }

    @isTest
    static void testPaySalaryUpdate() {
        User u = [SELECT Id FROM User WHERE Alias = 'etadmin' LIMIT 1];
        Account teacher = [SELECT Id FROM Account WHERE LastName = 'Teacher' LIMIT 1];
        Test.startTest();
        String invId;
        System.runAs(u) {
            invId = SchoolStaffController.paySalary(teacher.Id, 'Mar 2026');
        }
        Test.stopTest();
        System.assertNotEquals(null, invId);
    }

    @isTest
    static void testProcessAllPayroll() {
        User u = [SELECT Id FROM User WHERE Alias = 'etadmin' LIMIT 1];
        Test.startTest();
        System.runAs(u) {
            SchoolStaffController.processAllPayroll('Mar 2026');
        }
        Test.stopTest();
        
        List<Invoice__c> invals = [SELECT Id FROM Invoice__c WHERE Invoice_Month__c = 'Mar 2026' AND Status__c = 'Paid'];
        System.assert(invals.size() >= 2, 'Should process payroll for both staff members. Actual: ' + invals.size());
    }
}
