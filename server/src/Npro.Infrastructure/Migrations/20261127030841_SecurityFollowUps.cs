using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Npro.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SecurityFollowUps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AnonymisedAt",
                table: "People",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DeactivatedAt",
                table: "People",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "LastSignInAt",
                table: "People",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "MustChangePassword",
                table: "People",
                type: "bit",
                nullable: false,
                defaultValue: false);
            // People deactivated before this release start their retention period now
            // (EXEC: compiled only when it runs, so the idempotent SQL script works on a new database)
            migrationBuilder.Sql("EXEC(N'UPDATE [People] SET [DeactivatedAt] = SYSDATETIMEOFFSET() WHERE [Inactive] = 1')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AnonymisedAt",
                table: "People");

            migrationBuilder.DropColumn(
                name: "DeactivatedAt",
                table: "People");

            migrationBuilder.DropColumn(
                name: "LastSignInAt",
                table: "People");

            migrationBuilder.DropColumn(
                name: "MustChangePassword",
                table: "People");
        }
    }
}
