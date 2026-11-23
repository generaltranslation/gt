import { Select } from 'gt-react';

export default function SettingsForm() {
  const theme: string = 'dark';
  return (
    <form>
      <fieldset>
        <legend>Appearance</legend>
        <label>Theme</label>
        <Select value={theme} dark="Dark mode enabled" light="Light mode enabled">System default</Select>
      </fieldset>
      <fieldset>
        <legend>Notifications</legend>
        <label>Email notifications</label>
        <p>Configure how you receive updates.</p>
      </fieldset>
      <button>Save settings</button>
    </form>
  );
}
