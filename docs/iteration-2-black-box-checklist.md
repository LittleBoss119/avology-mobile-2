# Iteration 2 Black-Box Checklist

Use this checklist for manual HP testing after running the app with `.env.local`.

Status legend: `Not Run`, `Pass`, `Fail`.

## Tree Management

| ID | Scenario | Role | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-TREE-01 | Open owner tree list from owner home | Owner active | Tree list opens and shows active trees by default | Not Run |
| TC-TREE-02 | Create tree with valid data | Owner active | Tree is created and appears in active tree list | Not Run |
| TC-TREE-03 | Create tree with empty tree code | Owner active | Submission is blocked with required tree code error | Not Run |
| TC-TREE-04 | Create tree with duplicate tree code in same farm | Owner active | Submission fails with friendly duplicate code error | Not Run |
| TC-TREE-05 | Open tree detail from owner list | Owner active | Detail shows tree identity, condition, archive status, and condition history | Not Run |
| TC-TREE-06 | Edit tree variety or row/column | Owner active | Detail reflects updated tree data after returning | Not Run |
| TC-TREE-07 | Archive active tree from owner detail | Owner active | Tree disappears from active filter and remains available in archived filter | Not Run |
| TC-TREE-08 | Restore archived tree from owner detail | Owner active | Tree returns to active filter | Not Run |
| TC-TREE-09 | Open worker tree list | Worker active | Only active non-archived trees are shown, with no create/edit/archive controls | Not Run |

## Condition Reports

| ID | Scenario | Role | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-COND-01 | Open condition report form from owner tree detail | Owner active | Form opens and shows tree identity | Not Run |
| TC-COND-02 | Owner submits `needs_attention` report | Owner active | Report is saved, detail reloads, current condition updates, newest report appears first | Not Run |
| TC-COND-03 | Open condition report form from worker tree detail | Worker active | Form opens and shows tree identity, without owner-only controls | Not Run |
| TC-COND-04 | Worker submits `pest_attacked` report | Worker active | Report is saved, detail reloads, current condition updates, newest report appears first | Not Run |
| TC-COND-05 | Submit report without condition status | Owner/Worker active | Submission is blocked with condition required error | Not Run |
| TC-COND-06 | View condition history after multiple reports | Owner/Worker active | History contains only condition reports and is ordered newest first | Not Run |

## Role Access

| ID | Scenario | Role | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-ROLE-01 | Manually open `/owner/trees` | Worker active | Redirected away by owner route guard | Not Run |
| TC-ROLE-02 | Manually open owner create/edit tree route | Worker active | Redirected away by owner route guard | Not Run |
| TC-ROLE-03 | Manually open worker tree list/detail/report routes | Worker pending | Redirected to pending approval; no operational data visible | Not Run |
| TC-ROLE-04 | Manually open worker tree list/detail/report routes | Worker rejected | Redirected to rejected screen; no operational data visible | Not Run |
| TC-ROLE-05 | Manually open worker tree list/detail/report routes | Worker removed | Redirected to removed access screen; no operational data visible | Not Run |
| TC-ROLE-06 | Try to access archived tree from worker list | Worker active | Archived tree is not listed | Not Run |
| TC-ROLE-07 | Deep-link worker directly to archived tree detail/report | Worker active | Screen denies access to archived tree | Not Run |
| TC-ROLE-08 | Confirm owner can view archived tree detail from archived filter | Owner active | Owner can open archived tree detail and restore it | Not Run |
| TC-ROLE-09 | Confirm pending/rejected/removed cannot read operational data | Worker pending/rejected/removed | Tree, task, and report data are not visible | Not Run |
