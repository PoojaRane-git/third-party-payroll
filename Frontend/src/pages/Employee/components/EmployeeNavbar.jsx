import React from "react";

const EmployeeNavbar = ({
  employeeName,
}) => {

  const name =
    employeeName || "Employee";

  return (
    <header className="employee-navbar">

      <div>
        <h2>
          Talent Corner
        </h2>

        <span>
          Employee Portal
        </span>
      </div>

      <div className="navbar-user">

        <div className="user-avatar">
          {name
            .charAt(0)
            .toUpperCase()}
        </div>

        <div>

          <strong>
            {name}
          </strong>

          <small>
            Employee
          </small>

        </div>

      </div>

    </header>
  );
};

export default EmployeeNavbar;