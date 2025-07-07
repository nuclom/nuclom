import { test, expect } from "@playwright/test";

test.describe("Member Invitation Workflow", () => {
  let orgId: string;
  let ownerId: string;
  let inviterId: string;

  test.beforeEach(async ({ page }) => {
    orgId = "test-org-1";
    ownerId = "owner-user-1";
    inviterId = "inviter-user-1";

    // Mock authentication for organization owner
    await page.route("**/api/auth/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          user: { id: ownerId, name: "Organization Owner", email: "owner@example.com" },
        }),
      });
    });

    // Mock organizations list
    await page.route("**/api/organizations", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: orgId,
            name: "Test Organization",
            slug: "test-org",
            role: "owner",
          },
        ]),
      });
    });

    // Mock organization members and invitations
    let pendingInvitations = [
      {
        id: "invitation-1",
        email: "pending@example.com",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        inviter: {
          id: inviterId,
          name: "Inviter User",
          email: "inviter@example.com",
        },
      },
    ];

    let organizationMembers = [
      {
        id: "member-1",
        role: "owner",
        createdAt: new Date().toISOString(),
        user: {
          id: ownerId,
          name: "Organization Owner",
          email: "owner@example.com",
          image: null,
        },
      },
      {
        id: "member-2",
        role: "member",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        user: {
          id: "existing-member",
          name: "Existing Member",
          email: "existing@example.com",
          image: null,
        },
      },
    ];

    // Mock organization members API
    await page.route(`**/api/organizations/${orgId}/members`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: organizationMembers,
          }),
        });
      } else if (route.request().method() === "POST") {
        const body = await route.request().postDataJSON();

        if (body.email === "existing@example.com") {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              error: "User is already a member",
            }),
          });
          return;
        }

        if (body.email === "newuser@example.com") {
          // Add new member
          const newMember = {
            id: `member-${Date.now()}`,
            role: body.role || "member",
            createdAt: new Date().toISOString(),
            user: {
              id: "new-user",
              name: "New User",
              email: body.email,
              image: null,
            },
          };
          organizationMembers.push(newMember);

          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              type: "member",
              data: newMember,
            }),
          });
        } else {
          // Create invitation for non-existing user
          const newInvitation = {
            id: `invitation-${Date.now()}`,
            email: body.email,
            role: body.role || "member",
            status: "pending",
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            inviter: {
              id: ownerId,
              name: "Organization Owner",
              email: "owner@example.com",
            },
          };
          pendingInvitations.push(newInvitation);

          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              type: "invitation",
              data: newInvitation,
            }),
          });
        }
      } else if (route.request().method() === "PUT") {
        const url = new URL(route.request().url());
        const memberId = url.searchParams.get("memberId");
        const body = await route.request().postDataJSON();

        const member = organizationMembers.find((m) => m.id === memberId);
        if (member) {
          member.role = body.role;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: member,
            }),
          });
        } else {
          await route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "Member not found" }),
          });
        }
      } else if (route.request().method() === "DELETE") {
        const url = new URL(route.request().url());
        const memberId = url.searchParams.get("memberId");

        const memberIndex = organizationMembers.findIndex((m) => m.id === memberId);
        if (memberIndex !== -1) {
          organizationMembers.splice(memberIndex, 1);
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
          });
        } else {
          await route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "Member not found" }),
          });
        }
      }
    });

    // Mock pending invitations API
    await page.route(`**/api/organizations/${orgId}/invitations`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: pendingInvitations,
          }),
        });
      } else if (route.request().method() === "DELETE") {
        const url = new URL(route.request().url());
        const invitationId = url.searchParams.get("invitationId");

        const invitationIndex = pendingInvitations.findIndex((i) => i.id === invitationId);
        if (invitationIndex !== -1) {
          pendingInvitations.splice(invitationIndex, 1);
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
          });
        } else {
          await route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ error: "Invitation not found" }),
          });
        }
      }
    });

    // Mock invitation acceptance endpoint
    await page.route("**/api/invitations/*/accept", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          organizationId: orgId,
          organizationName: "Test Organization",
        }),
      });
    });

    // Login
    await page.goto("/login");
    await page.getByLabel("Email").fill("owner@example.com");
    await page.getByLabel("Password").first().fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
  });

  test("should display members and pending invitations", async ({ page }) => {
    await page.goto(`/${orgId}/settings/members`);

    // Check members section
    await expect(page.getByText("Organization Owner")).toBeVisible();
    await expect(page.getByText("Existing Member")).toBeVisible();
    await expect(page.getByText("owner")).toBeVisible();
    await expect(page.getByText("member")).toBeVisible();

    // Check pending invitations section
    await expect(page.getByText("Pending Invitations")).toBeVisible();
    await expect(page.getByText("pending@example.com")).toBeVisible();
    await expect(page.getByText("Invited by Inviter User")).toBeVisible();
  });

  test("should invite new user via email", async ({ page }) => {
    await page.goto(`/${orgId}/settings/members`);

    // Click invite member button
    await page.getByRole("button", { name: /invite member/i }).click();

    // Fill invitation form
    await page.getByLabel("Email").fill("newuser@example.com");
    await page.getByLabel("Role").selectOption("member");

    // Send invitation
    await page.getByRole("button", { name: /send invitation/i }).click();

    // Should show success message
    await expect(page.getByText("Member added successfully")).toBeVisible();

    // Should update member list immediately (existing user)
    await expect(page.getByText("newuser@example.com")).toBeVisible();
  });

  test("should invite non-existing user and create pending invitation", async ({ page }) => {
    await page.goto(`/${orgId}/settings/members`);

    // Click invite member button
    await page.getByRole("button", { name: /invite member/i }).click();

    // Fill invitation form with non-existing user
    await page.getByLabel("Email").fill("nonexisting@example.com");
    await page.getByLabel("Role").selectOption("member");

    // Send invitation
    await page.getByRole("button", { name: /send invitation/i }).click();

    // Should show invitation sent message
    await expect(page.getByText("Invitation sent successfully")).toBeVisible();

    // Should update pending invitations list
    await expect(page.getByText("nonexisting@example.com")).toBeVisible();
    await expect(page.getByText("Pending")).toBeVisible();
  });

  test("should handle duplicate invitation errors", async ({ page }) => {
    await page.goto(`/${orgId}/settings/members`);

    // Try to invite existing member
    await page.getByRole("button", { name: /invite member/i }).click();
    await page.getByLabel("Email").fill("existing@example.com");
    await page.getByRole("button", { name: /send invitation/i }).click();

    // Should show error message
    await expect(page.getByText("User is already a member")).toBeVisible();
  });

  test("should resend invitation", async ({ page }) => {
    await page.goto(`/${orgId}/settings/members`);

    // Find pending invitation and resend
    const invitationRow = page.locator("text=pending@example.com").locator("xpath=ancestor::tr");
    await invitationRow.getByRole("button", { name: /resend/i }).click();

    // Should show success message
    await expect(page.getByText("Invitation resent successfully")).toBeVisible();
  });

  test("should cancel pending invitation", async ({ page }) => {
    await page.goto(`/${orgId}/settings/members`);

    // Find pending invitation and cancel
    const invitationRow = page.locator("text=pending@example.com").locator("xpath=ancestor::tr");
    await invitationRow.getByRole("button", { name: /cancel/i }).click();

    // Confirm cancellation
    await page.getByRole("button", { name: /confirm/i }).click();

    // Should show success message
    await expect(page.getByText("Invitation cancelled")).toBeVisible();

    // Invitation should be removed from list
    await expect(page.getByText("pending@example.com")).not.toBeVisible();
  });

  test("should show invitation expiry information", async ({ page }) => {
    await page.goto(`/${orgId}/settings/members`);

    // Should show expiry information
    await expect(page.getByText(/expires in \d+ days/i)).toBeVisible();

    // Should show relative time
    await expect(page.getByText(/sent \d+ hours? ago/i)).toBeVisible();
  });

  test("should handle invitation role changes", async ({ page }) => {
    await page.goto(`/${orgId}/settings/members`);

    // Invite with owner role
    await page.getByRole("button", { name: /invite member/i }).click();
    await page.getByLabel("Email").fill("newowner@example.com");
    await page.getByLabel("Role").selectOption("owner");
    await page.getByRole("button", { name: /send invitation/i }).click();

    // Should show role in invitation
    await expect(page.getByText("Owner")).toBeVisible();
  });

  test("should validate invitation form", async ({ page }) => {
    await page.goto(`/${orgId}/settings/members`);

    // Open invitation form
    await page.getByRole("button", { name: /invite member/i }).click();

    // Try to send without email
    await page.getByRole("button", { name: /send invitation/i }).click();

    // Should show validation error
    await expect(page.getByText("Email is required")).toBeVisible();

    // Enter invalid email
    await page.getByLabel("Email").fill("invalid-email");
    await page.getByRole("button", { name: /send invitation/i }).click();

    // Should show email validation error
    await expect(page.getByText("Please enter a valid email address")).toBeVisible();
  });

  test("should limit invitation actions based on permissions", async ({ page }) => {
    // Mock user as member (not owner)
    await page.route("**/api/auth/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          user: { id: "member-user", name: "Regular Member", email: "member@example.com" },
        }),
      });
    });

    await page.goto(`/${orgId}/settings/members`);

    // Should not show invite button for members
    await expect(page.getByRole("button", { name: /invite member/i })).not.toBeVisible();

    // Should not show cancel invitation buttons
    await expect(page.getByRole("button", { name: /cancel/i })).not.toBeVisible();

    // Should show permission notice
    await expect(page.getByText("Only owners can manage member invitations")).toBeVisible();
  });

  test("should handle bulk member operations", async ({ page }) => {
    await page.goto(`/${orgId}/settings/members`);

    // Select multiple members
    await page.getByRole("checkbox").first().check();
    await page.getByRole("checkbox").nth(1).check();

    // Bulk actions should appear
    await expect(page.getByText("2 members selected")).toBeVisible();
    await expect(page.getByRole("button", { name: /remove selected/i })).toBeVisible();
  });

  test("should show member activity and last seen", async ({ page }) => {
    // Mock member activity
    await page.route(`**/api/organizations/${orgId}/members`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: "member-1",
                role: "owner",
                createdAt: new Date().toISOString(),
                lastActiveAt: new Date().toISOString(),
                user: {
                  id: ownerId,
                  name: "Organization Owner",
                  email: "owner@example.com",
                  image: null,
                },
              },
              {
                id: "member-2",
                role: "member",
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                lastActiveAt: new Date(Date.now() - 3600000).toISOString(),
                user: {
                  id: "existing-member",
                  name: "Existing Member",
                  email: "existing@example.com",
                  image: null,
                },
              },
            ],
          }),
        });
      }
    });

    await page.goto(`/${orgId}/settings/members`);

    // Should show activity status
    await expect(page.getByText("Active now")).toBeVisible();
    await expect(page.getByText(/last seen \d+ hours? ago/i)).toBeVisible();
  });

  test("should accept invitation via email link", async ({ page }) => {
    // Mock user not logged in
    await page.route("**/api/auth/**", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Not authenticated" }),
      });
    });

    // Navigate to invitation acceptance page
    await page.goto("/invitations/invitation-1/accept");

    // Should redirect to login with invitation context
    await expect(page).toHaveURL(/\/login\?invitation=invitation-1/);

    // Should show invitation context
    await expect(page.getByText("You've been invited to join Test Organization")).toBeVisible();
    await expect(page.getByText("Please sign in or create an account to accept this invitation")).toBeVisible();
  });

  test("should accept invitation when logged in", async ({ page }) => {
    // Navigate to invitation acceptance page
    await page.goto("/invitations/invitation-1/accept");

    // Should show invitation details
    await expect(page.getByText("Join Test Organization")).toBeVisible();
    await expect(page.getByText("You've been invited as a member")).toBeVisible();

    // Accept invitation
    await page.getByRole("button", { name: /accept invitation/i }).click();

    // Should redirect to organization
    await expect(page).toHaveURL(`/${orgId}`);
    await expect(page.getByText("Welcome to Test Organization!")).toBeVisible();
  });

  test("should decline invitation", async ({ page }) => {
    await page.goto("/invitations/invitation-1/accept");

    // Decline invitation
    await page.getByRole("button", { name: /decline/i }).click();

    // Should show decline confirmation
    await expect(page.getByText("Invitation declined")).toBeVisible();
    await expect(page.getByText("You can still accept this invitation later if you change your mind")).toBeVisible();
  });

  test("should handle expired invitations", async ({ page }) => {
    // Mock expired invitation
    await page.route("**/api/invitations/expired-invitation/accept", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Invitation has expired",
        }),
      });
    });

    await page.goto("/invitations/expired-invitation/accept");

    // Should show expiry message
    await expect(page.getByText("This invitation has expired")).toBeVisible();
    await expect(page.getByText("Please contact the organization owner for a new invitation")).toBeVisible();
  });

  test("should handle invalid invitations", async ({ page }) => {
    // Mock invalid invitation
    await page.route("**/api/invitations/invalid-invitation/accept", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Invitation not found",
        }),
      });
    });

    await page.goto("/invitations/invalid-invitation/accept");

    // Should show error message
    await expect(page.getByText("Invitation not found")).toBeVisible();
    await expect(page.getByText("This invitation may have been cancelled or does not exist")).toBeVisible();
  });

  test("should show organization context in invitation", async ({ page }) => {
    await page.goto("/invitations/invitation-1/accept");

    // Should show organization details
    await expect(page.getByText("Test Organization")).toBeVisible();
    await expect(page.getByText("Invited by Inviter User")).toBeVisible();

    // Should show what joining includes
    await expect(page.getByText("Access to organization videos")).toBeVisible();
    await expect(page.getByText("Collaborate with team members")).toBeVisible();
    await expect(page.getByText("Join channels and discussions")).toBeVisible();
  });

  test("should handle invitation acceptance errors", async ({ page }) => {
    // Mock acceptance error
    await page.route("**/api/invitations/invitation-1/accept", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Failed to process invitation",
        }),
      });
    });

    await page.goto("/invitations/invitation-1/accept");

    await page.getByRole("button", { name: /accept invitation/i }).click();

    // Should show error message
    await expect(page.getByText("Failed to process invitation")).toBeVisible();
    await expect(page.getByText("Please try again or contact support")).toBeVisible();
  });
});
