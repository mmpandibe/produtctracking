using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Npro.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EmployeeId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EmployeeId",
                table: "People",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            // Demo people seeded before this column existed get the same IDs as a fresh seed (EMP-001 …)
            // EXEC: compiled only when it runs, so the idempotent SQL script (deploy/sql/02-schema.sql) works on a new database
            migrationBuilder.Sql("EXEC(N'UPDATE People SET EmployeeId = ''EMP-'' + RIGHT(''000'' + SUBSTRING(Id, 2, 10), 3) WHERE Kind = ''internal'' AND EmployeeId IS NULL AND Id IN (''u1'',''u2'',''u3'',''u4'',''u5'',''u6'',''u7'',''u8'',''u9'',''u12'',''u13'')')");

            migrationBuilder.CreateIndex(
                name: "IX_People_EmployeeId",
                table: "People",
                column: "EmployeeId",
                unique: true,
                filter: "[EmployeeId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_People_EmployeeId",
                table: "People");

            migrationBuilder.DropColumn(
                name: "EmployeeId",
                table: "People");
        }
    }
}
