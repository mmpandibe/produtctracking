# Test Cases

| | |
|---|---|
| Document ID | NPRO-TC-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Precondition (all) | Demo data; API running unless stated; signed in as the named person (demo employee IDs: EMP-001 Alex admin, EMP-002 Priya division head, EMP-006 Meera assistant manager, EMP-008 Lena BA, EMP-003 Sam tech lead, EMP-004 Jordan developer, EMP-013 Ana support; Dana `dana@acme.test` client user) |

"Auto" names the automated test covering the case (A = Angular suite, S = server test). Execution results: Test Execution Report.

## FR-01 Products
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR01-01 | Priya: Products › Create product, key "sd", name " Support Desk " | Saved as key SD, name trimmed; card shown | A: DataStore › creates a product |
| TC-FR01-02 | Jordan: open Products | No create / edit / delete actions | A: Roles & access |
| TC-FR01-03 | Alex: delete a product | Product and its tickets removed after confirmation | A: DataStore › deletes a product |

## FR-02 Tickets
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR02-01 | Jordan: create a task on Web App | Next key WEB-n assigned; reporter = Jordan | A: DataStore tickets; S: Two_people_guessing… |
| TC-FR02-02 | Filter tickets by product + status + assignee; search "login" | Only matching rows; counts update | A: DataStore tickets |
| TC-FR02-03 | Change status inline to a status not allowed by the workflow | Option not offered | A: Workflows & custom fields |
| TC-FR02-04 | Open `/tickets?assignee=me` | Assignee filter preset | — (manual) |

## FR-03 Ticket detail
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR03-01 | Add a comment | Comment shown with author and time; saved after reload | A: comments; manual verified 26 Nov |
| TC-FR03-02 | Attach a file, delete it | Listed with size; removed | A: attachments |
| TC-FR03-03 | Change priority and assignee | History shows "updated priority, assignee" | A: …history |

## FR-04 Board
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR04-01 | Drag a card to another column | Status changes; toast | A: DataStore board moves |
| TC-FR04-02 | Use the card's Move menu by keyboard (Enter, arrows, Enter) | Card moves; focus returns to the menu button | manual verified 26 Nov |
| TC-FR04-03 | With transitions restricted, move to a forbidden status | Refused with message | A: board moves |

## FR-05 Backlog & sprints · FR-06 Roadmaps · FR-07 Time
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR05-01 | Start a sprint, complete it moving unfinished tickets to the backlog | Points recorded; tickets moved | A: sprint lifecycle |
| TC-FR05-02 | Set story points inline | Velocity and totals update | A: sprints… |
| TC-FR06-01 | Create a roadmap, link 2 sprints | % complete from their points | A: Roadmaps… |
| TC-FR07-01 | Start timer on WEB-2, start another on WEB-3 | First timer stopped and logged | A: timer |
| TC-FR07-02 | Jordan opens Time Tracking | Only his own time selectable | A: Roles & access |

## FR-08 · FR-09 · FR-10
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR08-01 | Create client, link products, archive | Shown in lists; users deactivated on delete | A: Clients and SLA policies |
| TC-FR09-01 | Reports: product-wise table, CSV export | Numbers match tickets; CSV downloads | A: Report calculations |
| TC-FR09-02 | Month-wise hours person × client | Shares add up to 100 % | A: Month-wise hours matrix |
| TC-FR10-01 | CXO summary week, add comment, print | KPIs vs previous period; comment kept; print layout | A: CXO period summary |

## FR-11 Workflows & fields
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR11-01 | Reorder statuses by drag and by arrow buttons | Board columns follow order | A: Workflows…; manual |
| TC-FR11-02 | Delete a status in use | Must pick a replacement; tickets moved | A: Workflows… |
| TC-FR11-03 | Add a required custom field for one product | Ticket dialog requires it for that product only | A: Workflows… |

## FR-12 Organisation
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR12-01 | Add internal person without employee ID | Error "Employee ID is required" | A: Employee IDs; S: Admin_adds… |
| TC-FR12-02 | Add person with EMP-004 | Error "already used by Jordan Diaz" (also refused by server) | A / S |
| TC-FR12-03 | Add person with emp-014 → set password from row menu → sign in as EMP-014 | Saved as EMP-014; sign-in works | S: Admin_adds_a_person… ; manual verified 26–27 Nov |
| TC-FR12-04 | Make a person report to someone who reports to them | Refused | A: Organisation |

## FR-13 Access
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR13-01 | Ravi (division head, Enterprise) opens Products | Only ANL | S: Division_heads_see… |
| TC-FR13-02 | Dana opens `/tickets/WEB-3` | "You don't have access"; API 403 | S: Client_users_see_only… |
| TC-FR13-03 | Dana's API call edits MOB-3 summary | 403, nothing saved | S: Client_users_can_comment_but_not_edit… |
| TC-FR13-04 | Jordan's API call renames a product | 403 | S: Developer_creates_a_ticket_but_cannot_rename… |

## FR-14 Support
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR14-01 | L1 queue shows clocks; breached first | Correct states | A: Support desk & SLA |
| TC-FR14-02 | Escalate ANL-2 with a reason | Level L3, unassigned, reason comment, history | A: Support desk & SLA |
| TC-FR14-03 | Change L1 high response target | Clocks recalculate | A: Clients and SLA policies |

## FR-15 Gantt
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR15-01 | Drag a sprint bar 3 days right | Dates saved; toast | A: Gantt & roadmap timeline |
| TC-FR15-02 | Jordan tries to move a sprint | Not movable | A: Gantt… |

## FR-16 Attendance · FR-17 Integrations
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR16-01 | Jordan applies for weekend-only leave | Refused | A: External productivity & attendance |
| TC-FR16-02 | Jordan requests correction for today | Refused ("days that are over") | A: … |
| TC-FR16-03 | Sam approves Jordan's leave | Approved; balance reduced | A: … |
| TC-FR16-04 | Productivity tab shows bars + logged marker | Values consistent | A: … |
| TC-FR17-01 | Switch attendance source to "Company system" | Error "needs the nPro backend" shown | A: … |

## FR-18 Dashboards & search
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR18-01 | Jordan: dashboard | My day only (no team view) | manual verified 26 Nov |
| TC-FR18-02 | Meera: dashboard My team | Team attendance, workload, sprints | manual verified 26 Nov |
| TC-FR18-03 | Ctrl+K "jordan" Enter | Opens tickets assigned to Jordan | A: Global search; manual verified |

## FR-19 Automation
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR19-01 | Enable round-robin; raise support ticket | Assigned to Ana by "Automation"; history shows rule | S: Automation_runs_on_the_server…; manual verified 26 Nov |
| TC-FR19-02 | Rule moves bug to Testing with New→Testing forbidden | Run "partial", "Skipped: … isn't allowed" | S: Set_status_actions_respect… |
| TC-FR19-03 | Breached L1 ticket with escalate rule on | Escalated once to L2 with comment | S: Timed_rules_run_on_the_server_once… |
| TC-FR19-04 | Two rules triggering each other | No loop; each runs once per chain | A: Automation rules |

## FR-20 Authentication
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR20-01 | Wrong password | "Wrong email, employee ID or password" | S: Data_needs_a_signed_in_person…; manual verified |
| TC-FR20-02 | Sign in with emp-004 (lower case) | Signed in as Jordan | S (ApiTests); manual verified (EMP-001) |
| TC-FR20-03 | 5 wrong passwords | 423, locked 5 minutes | — (manual, open) |
| TC-FR20-04 | Sign out | Login page; `/api/auth/me` 401 | S: Me_returns…; manual verified |

## FR-21 Server data · FR-22 Offline demo
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-FR21-01 | Comment, reload | Still there; not in localStorage | manual verified 26 Nov |
| TC-FR21-02 | Same guessed key from two creates | Second renamed WEB-(n+1) | S: Two_people_guessing… |
| TC-FR21-03 | Batch with one forbidden change | 403; nothing saved | S: A_refused_change_rolls_back… |
| TC-FR21-04 | Change in browser A, wait 30 s in browser B | Appears in B | S: The_version_moves…; manual open |
| TC-FR22-01 | Stop API, open app | Offline demo, no login page | manual verified 26 Nov |

## Non-functional
| ID | Steps | Expected | Auto |
|---|---|---|---|
| TC-NFR01-01 | axe scan desktop (31 states) | 0 violations | `npm run a11y` |
| TC-NFR01-02 | axe scan 320 px | 0 violations, no overflow | `npm run a11y:mobile` |
| TC-NFR01-03 | First Tab = skip link → Enter | Focus on main content | manual verified 26 Nov |
| TC-NFR01-04 | Open / close a dialog with keyboard | Focus in, trapped, Escape, returns | manual verified 26 Nov |
| TC-NFR01-05 | NVDA walkthrough of TS-03 | All controls announced | open |
| TC-NFR02-01 | POST without X-XSRF-TOKEN | 400 | S: Writes_without_the_xsrf_token… |
| TC-NFR02-02 | Unauthenticated GET /api/products | 401 | S: Data_needs_a_signed_in_person… |
| TC-NFR02-03 | Comment as another person via API | 403 | S: Client_users_can_comment_but_not_… impersonate |
| TC-NFR02-04 | Non-admin sets a password via API | 403 | S: Admin_adds_a_person… |
| TC-NFR02-05 | Auth cookie flags | HttpOnly, SameSite=Strict (Secure on HTTPS) | manual (dev tools) open |
| TC-NFR03-01 | Read endpoints under 20 concurrent requests | p95 < 500 ms | Performance report (local baseline) |
| TC-NFR05-01 | All screens 320 px | No horizontal scroll | a11y scan overflow check |
