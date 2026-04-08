export default function TableMixedCells() {
  const user = { name: 'Alice', age: 30 };
  return (
    <table>
      <tbody>
        <tr>
          <td>Name</td>
          <td>{user.name}</td>
          <td>Age: {user.age}</td>
        </tr>
      </tbody>
    </table>
  );
}
