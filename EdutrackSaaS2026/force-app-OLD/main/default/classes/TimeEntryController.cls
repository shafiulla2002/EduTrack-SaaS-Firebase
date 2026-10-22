public without sharing class TimeEntryController {

    @AuraEnabled(cacheable=true)
    public static List<Project__c> getProjects() {
        try {
            List<Project__c> projects = [SELECT Id, Name FROM Project__c];
            System.debug('Fetched projects: ' + projects.size() + ' records');
            return projects;
        } catch (Exception e) {
            System.debug('Error fetching projects: ' + e.getMessage());
            throw new AuraHandledException('Error fetching projects: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Workstream__c> getWorkstreams() {
        try {
            List<Workstream__c> workstreams = [SELECT Id, Name FROM Workstream__c];
            System.debug('Fetched workstreams: ' + workstreams.size() + ' records');
            return workstreams;
        } catch (Exception e) {
            System.debug('Error fetching workstreams: ' + e.getMessage());
            throw new AuraHandledException('Error fetching workstreams: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Id saveTimeEntry(Id entryId, Id projectId, Id workstreamId, Decimal hours, String description, String entryDate, Boolean isBillable) {
        try {
            // Validate entryDate
            if (String.isBlank(entryDate)) {
                System.debug('Error: entryDate is null or blank');
                throw new AuraHandledException('Entry date cannot be null or blank');
            }
            Date parsedDate;
            try {
                parsedDate = Date.valueOf(entryDate);
                System.debug('Parsed entryDate to: ' + parsedDate);
            } catch (Exception e) {
                System.debug('Error parsing entryDate: ' + entryDate + ', Error: ' + e.getMessage());
                throw new AuraHandledException('Invalid date format: ' + entryDate);
            }

            Time_Entry__c entry;
            if (entryId != null) {
                entry = [SELECT Id, Project__c, ProjectStream__c, Hours_Spent__c, Description__c, Date__c, Billable__c 
                         FROM Time_Entry__c 
                         WHERE Id = :entryId 
                         LIMIT 1 FOR UPDATE];
                System.debug('Fetched existing entry for update: ' + entryId + ', Current Hours_Spent__c: ' + entry.Hours_Spent__c);
            } else {
                entry = new Time_Entry__c();
                System.debug('Creating new time entry');
            }
            
            // Validate and adjust hours if necessary (assuming LWC might pass minutes)
            Decimal adjustedHours = hours != null ? hours : 0;
            if (adjustedHours > 1 && adjustedHours < 10) {
                // If hours seem like minutes (e.g., 1.56 might be minutes passed incorrectly), convert to 0.01 scale
                adjustedHours = adjustedHours / 100;
                System.debug('Adjusted hours from possible minutes value: ' + hours + ' to ' + adjustedHours);
            }
            System.debug('Final hours to save: ' + adjustedHours);

            entry.Project__c = projectId;
            entry.ProjectStream__c = workstreamId;
            entry.Hours_Spent__c = adjustedHours;
            entry.Description__c = String.isBlank(description) ? null : description;
            entry.Date__c = parsedDate;
            entry.Billable__c = isBillable != null ? isBillable : false;

            upsert entry;
            System.debug('Upserted time entry: Id=' + entry.Id + ', Date__c=' + entry.Date__c + ', Project__c=' + entry.Project__c + ', Hours_Spent__c=' + entry.Hours_Spent__c);
            return entry.Id;
        } catch (Exception e) {
            System.debug('Error saving time entry: ' + e.getMessage() + ' at line ' + e.getLineNumber());
            throw new AuraHandledException('Error saving time entry: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static List<Map<String, Object>> getTimeEntriesForWeek(Date weekStart) {
        try {
            if (weekStart == null) {
                System.debug('Error: weekStart is null');
                throw new AuraHandledException('Week start date cannot be null');
            }
            Date weekEnd = weekStart.addDays(6);
            List<Time_Entry__c> entries = [
                SELECT Id, Project__c, Project__r.Name, ProjectStream__c, ProjectStream__r.Name,
                       Hours_Spent__c, Description__c, Date__c, Billable__c
                FROM Time_Entry__c
                WHERE Date__c >= :weekStart AND Date__c <= :weekEnd
                AND OwnerId = :UserInfo.getUserId()
                ORDER BY Date__c
            ];
            System.debug('Fetching time entries for week: ' + weekStart + ' to ' + weekEnd + ', UserId: ' + UserInfo.getUserId());
            System.debug('Fetched entries: ' + entries.size() + ' records');
            if (!entries.isEmpty()) {
                System.debug('Entry details: ' + JSON.serialize(entries));
            }
            return NamespaceUtils.stripNamespaceList(entries);
        } catch (Exception e) {
            System.debug('Error fetching time entries: ' + e.getMessage());
            throw new AuraHandledException('Error fetching time entries: ' + e.getMessage());
        }
    }
}