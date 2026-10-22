@isTest
private class TimeEntryControllerTest {

    // Helper method to create test data
    private static void createTestData() {
        Project__c project = new Project__c(Name = 'Test Project');
        insert project;

        Workstream__c workstream = new Workstream__c(Workstream_Name__c = 'Test Workstream');
        insert workstream;

        Time_Entry__c timeEntry = new Time_Entry__c(
            Project__c = project.Id,
            ProjectStream__c = workstream.Id,
            Hours_Spent__c = 2.0,
            Description__c = 'Initial test entry',
            Date__c = Date.today(),
            Billable__c = true
        );
        insert timeEntry;
    }

    @isTest
    static void testGetProjects() {
        insert new Project__c(Name = 'Project A');
        Test.startTest();
        List<Project__c> projects = TimeEntryController.getProjects();
        Test.stopTest();
        System.assertNotEquals(0, projects.size(), 'Projects should be returned');
    }

    @isTest
    static void testGetWorkstreams() {
        insert new Workstream__c(Workstream_Name__c = 'Workstream A');
        Test.startTest();
        List<Workstream__c> workstreams = TimeEntryController.getWorkstreams();
        Test.stopTest();
        System.assertNotEquals(0, workstreams.size(), 'Workstreams should be returned');
    }

    @isTest
    static void testSaveTimeEntry_CreateNew() {
        Project__c project = new Project__c(Name = 'Project SaveTest');
        insert project;

        Workstream__c workstream = new Workstream__c(Workstream_Name__c = 'Workstream SaveTest');
        insert workstream;

        String dateStr = String.valueOf(Date.today());

        Test.startTest();
        Id newEntryId = TimeEntryController.saveTimeEntry(
            null,
            project.Id,
            workstream.Id,
            2.25,
            'Test Description',
            dateStr,
            true
        );
        Test.stopTest();

        Time_Entry__c savedEntry = [SELECT Id, Description__c FROM Time_Entry__c WHERE Id = :newEntryId];
        System.assertEquals('Test Description', savedEntry.Description__c);
    }

    @isTest
    static void testSaveTimeEntry_UpdateExisting() {
        createTestData();
        Time_Entry__c existingEntry = [SELECT Id, Project__c, ProjectStream__c, Hours_Spent__c, Date__c FROM Time_Entry__c LIMIT 1];

        String newDesc = 'Updated description';
        Decimal updatedHours = 3.5;
        String dateStr = String.valueOf(existingEntry.Date__c);

        Test.startTest();
        Id updatedId = TimeEntryController.saveTimeEntry(
            existingEntry.Id,
            existingEntry.Project__c,
            existingEntry.ProjectStream__c,
            updatedHours,
            newDesc,
            dateStr,
            false
        );
        Test.stopTest();

      
    }

    @isTest
    static void testGetTimeEntriesForWeek() {
        createTestData();
        Date today = Date.today();
        Date startOfWeek = today.toStartOfWeek(); // Ensures weekStart is consistent

        Test.startTest();
        List<Map<String, Object>> entries = TimeEntryController.getTimeEntriesForWeek(startOfWeek);
        Test.stopTest();

        System.assertNotEquals(0, entries.size(), 'Should fetch time entries for the current week');
    }

}