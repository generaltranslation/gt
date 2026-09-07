import type { Example } from '../types';

/**
 * Hand-authored pages combine independent prop subtrees, control flow, collection
 * rendering, manual translation boundaries, opaque GT components, and nested
 * translation ownership. These complement the finite syntax matrices with
 * interactions that occur across whole layouts and multiple local components.
 */
const imports = `import * as React from 'react';
import { Fragment, Suspense } from 'react';
import { T as ManualT, Var as ManualVar, Num, Currency, DateTime, Branch, Plural, Derive, Static } from 'gt-next';
`;

function page(name: string, input: string): Example {
  return { name: `pages/${name}`, input: `${imports}${input}` };
}

export const examples: Example[] = [
  page(
    'analytics-dashboard',
    `
export function Page({ account, reports, selected }) {
  const toolbar = <nav aria-label="Reports"><button>Export {selected.size} reports</button><button disabled={!selected.size}>Archive</button></nav>;
  return <Dashboard title={<h1>Welcome back, {account.owner}</h1>} toolbar={toolbar}>
    <section><p>Your workspace has <Num>{reports.length}</Num> reports.</p>
      {reports.length ? <div>{reports.map(report => <Card key={report.id} title={<h2>{report.title}</h2>} footer={<small>Last updated <DateTime>{report.updatedAt}</DateTime></small>}>
        Revenue <Currency currency={report.currency}>{report.revenue}</Currency>
        {report.change > 0 ? <Badge>Up {report.change}%</Badge> : <Badge>No increase</Badge>}
      </Card>)}</div> : <EmptyState icon={<span>∅</span>}>Create your first report</EmptyState>}
    </section>
    <footer>Viewing {selected.size} of {reports.length} reports <ManualT>Help center</ManualT></footer>
  </Dashboard>;
}
`
  ),
  page(
    'checkout-cart',
    `
export function Page({ cart, coupon, address, pending }) {
  return <main><h1>Review your order</h1><form onSubmit={submit}>
    <ol>{cart.lines.flatMap(line => [<li key={line.id}>Buy <strong>{line.name}</strong> × {line.quantity}<Currency>{line.total}</Currency></li>, line.note && <li key={line.id + '-note'}>Note: {line.note}</li>])}</ol>
    <Card title={<h2>Delivery to {address.city}</h2>} details={address.apartment ? <p>Apartment {address.apartment}</p> : <p>No apartment specified</p>}>
      Ship to <ManualVar>{address.name}<br />{address.street}</ManualVar>
    </Card>
    <p>Discount: {coupon ? <strong>{coupon.label}: {coupon.percent}%</strong> : <em>None applied</em>}</p>
    <button disabled={pending}>{pending ? 'Placing order…' : 'Place order'}</button>
    <small>By ordering, you accept our <a href="/terms">terms &amp; conditions</a>.</small>
  </form></main>;
}
`
  ),
  page(
    'nested-data-table',
    `
export function Page({ groups, columns, expanded }) {
  return <table><caption>Results for {groups.length} groups</caption>
    <thead><tr><th>Group</th>{columns.map(column => <th key={column.id}>{column.title}</th>)}<th>Actions</th></tr></thead>
    <tbody>{groups.map(group => <Fragment key={group.id}>
      <tr><th>{group.name}</th>{columns.map(column => <td key={column.id}>Total {group.values[column.id] ?? 'Unavailable'}</td>)}<td><button>Expand {group.name}</button></td></tr>
      {expanded[group.id] && group.rows.map((row, index) => <tr key={row.id}><th>Row {index + 1}</th>{columns.map(column => <td key={column.id}>{column.render ? column.render(row) : <span>{row[column.id]}</span>}</td>)}<td><a href={row.href}>Open details</a></td></tr>)}
    </Fragment>)}</tbody>
    <tfoot><tr><td colSpan={columns.length + 2}>End of results <button>Load more</button></td></tr></tfoot>
  </table>;
}
`
  ),
  page(
    'kanban-board',
    `
export function Page({ lanes, filters }) {
  return <main><header><h1>Project board</h1><p>Showing {filters.query || 'all tasks'}</p></header>
    <div>{lanes.map(lane => <section key={lane.id} aria-label={lane.label}>
      <h2>{lane.title} <span>{lane.cards.length}</span></h2>
      {lane.cards.length === 0 && <p>Drop a card here</p>}
      {lane.cards.filter(card => !card.archived).map(card => <Card key={card.id} header={<h3>{card.title}</h3>} footer={<button>Assign to {card.owner?.name ?? 'someone'}</button>}>
        Task {card.number}: <span>{card.summary}</span>
        <ul>{card.checklist.map(item => <li key={item.id}>{item.done ? <s>{item.label}</s> : <b>Pending {item.label}</b>}</li>)}</ul>
      </Card>)}
      <button>Add a card to {lane.title}</button>
    </section>)}</div>
  </main>;
}
`
  ),
  page(
    'document-review',
    `
export function Page({ document, comments, canEdit }) {
  const aside = <aside><h2>Comments</h2>{comments.map(comment => <article key={comment.id}><h3>{comment.author}</h3><p>{comment.text}</p><button>Reply to {comment.author}</button></article>)}</aside>;
  return <SplitPane sidebar={aside} title={<h1>Review {document.title}</h1>}>
    <article><p>Draft <strong>{document.version}</strong> by {document.owner}</p>
      {document.sections.map(section => <section key={section.id}><h2>{section.heading}</h2>{section.paragraphs.map((text, index) => <p key={index}>{text}</p>)}</section>)}
      <ManualT>Confidential <ManualVar>{document.classification}</ManualVar></ManualT>
      <footer>{canEdit && <button>Edit document</button>}<button>Request changes</button><button>Approve version {document.version}</button></footer>
    </article>
  </SplitPane>;
}
`
  ),
  page(
    'chat-thread',
    `
export function Page({ thread, typing, me }) {
  return <main><h1>Conversation with {thread.members.filter(member => member.id !== me.id).map(member => member.name).join(', ')}</h1>
    <ol>{thread.messages.map(message => <li key={message.id}><article>
      <header>{message.author.name} wrote <DateTime>{message.sentAt}</DateTime></header>
      <ManualVar>{message.parts.map((part, i) => part.type === 'text' ? <p key={i}>{part.text}</p> : <Attachment key={i} file={part.file} />)}</ManualVar>
      {message.edited && <small>Edited</small>}
      <button>Reply</button><button>React to {message.author.name}'s message</button>
    </article></li>)}</ol>
    <p>{typing.length ? <Plural n={typing.length} one={<>{typing[0].name} is typing</>} other={<>{typing.length} people are typing</>} /> : 'No one is typing'}</p>
    <form><label htmlFor="message">Your message</label><textarea id="message" placeholder="Write a message" /><button>Send</button></form>
  </main>;
}
`
  ),
  page(
    'accessible-validation-form',
    `
export function Page({ fields, errors, submitted }) {
  return <form noValidate onSubmit={submit}>
    <h1>Create your profile</h1>
    {submitted && Object.keys(errors).length > 0 && <aside role="alert"><h2>Please fix these errors</h2><ul>{Object.entries(errors).map(([id, message]) => <li key={id}><a href={'#' + id}>Field {id}: {message}</a></li>)}</ul></aside>}
    {fields.map(field => <fieldset key={field.id}><legend>{field.label}</legend>
      <label htmlFor={field.id}>Enter {field.label} <span aria-hidden="true">*</span></label>
      <input {...field.inputProps} id={field.id} aria-describedby={field.id + '-help'} aria-invalid={Boolean(errors[field.id])} />
      <small id={field.id + '-help'}>Use the name shown on your {field.documentType}.</small>
      {errors[field.id] ? <p role="alert">Error: {errors[field.id]}</p> : <p>Looks good</p>}
    </fieldset>)}
    <button type="submit">Save profile</button>
  </form>;
}
`
  ),
  page(
    'command-palette',
    `
export function Page({ query, groups, selected }) {
  return <Dialog title={<h1>Search commands</h1>} description={<p>Type a command or choose an action.</p>}>
    <input aria-label="Search commands" value={query} />
    {groups.length ? groups.map(group => <section key={group.id}><h2>{group.name}</h2><ul role="listbox">
      {group.commands.map(command => <li key={command.id} aria-selected={selected === command.id}>
        <button><span>{command.icon}</span>{command.label}<kbd>{command.keys.map((key, index) => <Fragment key={index}>{index > 0 && '+'}{key}</Fragment>)}</kbd></button>
        {command.unavailable && <small>Requires access to {command.scope}</small>}
      </li>)}
    </ul></section>) : <p>No results for &quot;{query}&quot;</p>}
    <footer>Press <kbd>Esc</kbd> to close <span aria-hidden="true">·</span> <kbd>Enter</kbd> to select</footer>
  </Dialog>;
}
`
  ),
  page(
    'media-gallery',
    `
export function Page({ albums, active }) {
  return <main><h1>Media library</h1>{albums.map(album => <section key={album.id}>
    <h2>{album.name}</h2><p>{album.photos.length} photos from <DateTime>{album.date}</DateTime></p>
    <div>{album.photos.map(photo => <figure key={photo.id}><img src={photo.url} alt={photo.alt} />
      <figcaption>Photo by <a href={photo.creditUrl}>{photo.credit}</a>{photo.location && <> in <strong>{photo.location}</strong></>}</figcaption>
      <button>{active === photo.id ? <><span>✓</span> Selected</> : <>Select photo {photo.position}</>}</button>
    </figure>)}</div>
  </section>)}<footer><button>Upload photos</button><a href="/license">Read license details</a></footer></main>;
}
`
  ),
  page(
    'recursive-navigation',
    `
function Navigation({ items, depth = 0 }) {
  return <ul>{items.map(item => <li key={item.id}><a href={item.href}>{item.label}{item.badge && <small>New {item.badge}</small>}</a>
    {item.children?.length ? <Navigation items={item.children} depth={depth + 1} /> : depth > 0 && <span>End of section</span>}
  </li>)}</ul>;
}
export function Page({ sections, current }) {
  return <Layout sidebar={<nav aria-label="Main"><h2>Browse documentation</h2><Navigation items={sections} /></nav>}>
    <nav aria-label="Breadcrumb"><ol>{current.parents.map((parent, index) => <li key={parent.id}>{index ? <> / <a href={parent.href}>{parent.label}</a></> : <a href={parent.href}>Home</a>}</li>)}</ol></nav>
    <h1>{current.title}</h1><p>Documentation for {current.product}</p>
  </Layout>;
}
`
  ),
  page(
    'settings-sections',
    `
export function Page({ settings, providers, dirty }) {
  return <main><h1>Workspace settings</h1><Tabs active={settings.tab}>
    <Tabs.Panel title={<span>General</span>}><label>Workspace name <input value={settings.name} /></label><p>This name is visible to {settings.members.length} members.</p></Tabs.Panel>
    <Tabs.Panel title={<span>Integrations</span>}>{providers.map(provider => <section key={provider.id}>
      <h2>{provider.name}</h2><Branch branch={provider.state} connected={<p>Connected as {provider.account}</p>} failed={provider.error} pending={<p>Waiting for approval</p>}>Not connected</Branch>
      <button>{provider.connected ? 'Disconnect' : 'Connect'} {provider.name}</button>
    </section>)}</Tabs.Panel>
    <Tabs.Panel title={<span>Danger zone</span>}><p>Deleting <strong>{settings.name}</strong> cannot be undone.</p><button>Delete workspace</button></Tabs.Panel>
  </Tabs>{dirty && <footer>Unsaved changes <button>Save changes</button><button>Discard</button></footer>}</main>;
}
`
  ),
  page(
    'faceted-search',
    `
export function Page({ query, facets, results, total }) {
  return <SearchLayout filters={<aside><h2>Filter results</h2>{facets.map(facet => <fieldset key={facet.id}><legend>{facet.label}</legend>{facet.values.map(value => <label key={value.id}><input type="checkbox" checked={value.selected} />{value.label} <span>({value.count})</span></label>)}</fieldset>)}</aside>}>
    <h1>Results for &ldquo;{query}&rdquo;</h1><p><Plural n={total} one="One result" other={<>{total} results</>} /></p>
    <ol>{results.map(result => <li key={result.id}><h2><a href={result.href}>{result.title}</a></h2>
      <p>{result.snippet.map((part, index) => part.match ? <mark key={index}>{part.text}</mark> : <Fragment key={index}>{part.text}</Fragment>)}</p>
      <small>Updated {result.relativeTime} in {result.category}</small>
    </li>)}</ol>
    {results.length < total && <button>Show {Math.min(total - results.length, 20)} more results</button>}
  </SearchLayout>;
}
`
  ),
  page(
    'activity-feed',
    `
function Event({ event }) {
  switch (event.kind) {
    case 'invite': return <p>{event.actor} invited <strong>{event.target}</strong> to the workspace.</p>;
    case 'upload': return <p>{event.actor} uploaded {event.files.map(file => <a key={file.id} href={file.href}>{file.name}</a>)}.</p>;
    default: return <p>Activity from {event.actor}: <Derive>{event.summary}</Derive></p>;
  }
}
export function Page({ days }) {
  return <main><h1>Recent activity</h1>{days.map(day => <section key={day.date}><h2><DateTime>{day.date}</DateTime></h2><ol>{day.events.map(event => <li key={event.id}><Event event={event} /><small>At {event.time}</small></li>)}</ol></section>)}<button>Load earlier activity</button></main>;
}
`
  ),
  page(
    'calendar-schedule',
    `
export function Page({ weeks, month, selected }) {
  return <main><header><button>Previous month</button><h1>{month.label}</h1><button>Next month</button></header>
    <table><caption>Appointments in {month.label}</caption><thead><tr>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => <th key={day}>{day}</th>)}</tr></thead>
      <tbody>{weeks.map((week, weekIndex) => <tr key={weekIndex}>{week.map(day => <td key={day.date}>
        <button aria-pressed={selected === day.date}>Day {day.number}</button>
        {day.events.map(event => <div key={event.id}><strong>{event.time}</strong> {event.name}{event.cancelled && <em>Cancelled</em>}</div>)}
        {!day.events.length && <span>No appointments</span>}
      </td>)}</tr>)}</tbody>
    </table><aside><h2>Selected day</h2>{selected ? <p>Appointments for <DateTime>{selected}</DateTime></p> : <p>Choose a day to continue</p>}</aside>
  </main>;
}
`
  ),
  page(
    'invoice-details',
    `
export function Page({ invoice }) {
  const lines = invoice.groups.map(group => <Fragment key={group.id}><tr><th colSpan={3}>{group.label}</th></tr>{group.lines.map(line => <tr key={line.id}><td>{line.label}</td><td>{line.quantity}</td><td><Currency currency={invoice.currency}>{line.total}</Currency></td></tr>)}</Fragment>);
  return <article><header><h1>Invoice #{invoice.number}</h1><p>Issued <DateTime>{invoice.issuedAt}</DateTime> · Due <DateTime>{invoice.dueAt}</DateTime></p></header>
    <address><ManualVar>{invoice.customer.name}<br />{invoice.customer.address}</ManualVar></address>
    <table><thead><tr><th>Description</th><th>Quantity</th><th>Amount</th></tr></thead><tbody>{lines}</tbody><tfoot><tr><th colSpan={2}>Total due</th><td><Currency>{invoice.total}</Currency></td></tr></tfoot></table>
    <p>Payment reference: {invoice.reference ?? 'Not provided'}</p><button>Download invoice</button>
  </article>;
}
`
  ),
  page(
    'subscription-management',
    `
export function Page({ subscription, plans, usage }) {
  return <main><h1>Your subscription</h1><p>Current plan: <strong>{subscription.plan}</strong></p>
    <Branch branch={subscription.status} trial={<p>Trial ends in {subscription.daysLeft} days.</p>} active={<p>Renews on <DateTime>{subscription.renewal}</DateTime>.</p>} paused={<p>Billing paused</p>}>Contact support to restore your subscription.</Branch>
    <section><h2>Usage</h2>{Object.entries(usage).map(([metric, entry]) => <p key={metric}>{metric}: {entry.used} of {entry.limit ?? 'unlimited'}<progress value={entry.used} max={entry.limit} /></p>)}</section>
    <section><h2>Available plans</h2>{plans.map(plan => <Card key={plan.id} title={<h3>{plan.name}</h3>} action={<button>{plan.id === subscription.planId ? 'Current plan' : 'Switch plan'}</button>}>
      From <Currency>{plan.price}</Currency> per month <ul>{plan.features.map(feature => <li key={feature.id}><Derive>{feature.label}</Derive></li>)}</ul>
    </Card>)}</section>
  </main>;
}
`
  ),
  page(
    'code-diff-review',
    `
export function Page({ files, comments }) {
  return <main><h1>Review changes</h1><p>{files.length} files changed</p>
    {files.map(file => <section key={file.path}><h2><code>{file.path}</code></h2><p>Added {file.additions} lines, removed {file.deletions} lines</p>
      <pre><ManualVar>{file.lines.map((line, index) => <span key={index} data-kind={line.kind}>{line.number}{'\\t'}{line.text}{'\\n'}</span>)}</ManualVar></pre>
      <ul>{comments[file.path]?.map(comment => <li key={comment.id}>Line {comment.line}: <blockquote>{comment.body}</blockquote><button>Resolve thread</button></li>) ?? <li>No comments</li>}</ul>
    </section>)}<footer><button>Request changes</button><button>Approve all changes</button></footer>
  </main>;
}
`
  ),
  page(
    'onboarding-wizard',
    `
export function Page({ step, form, options }) {
  const body = (() => {
    if (step === 0) return <section><h2>Name your workspace</h2><label>Workspace name <input value={form.name} /></label></section>;
    if (step === 1) return <section><h2>Invite teammates</h2>{form.invites.map((invite, index) => <label key={index}>Teammate {index + 1}<input value={invite.email} /></label>)}</section>;
    return <section><h2>Choose a template</h2>{options.map(option => <button key={option.id}><strong>{option.title}</strong><small>{option.description}</small></button>)}</section>;
  })();
  return <main><header><h1>Set up {form.name || 'your workspace'}</h1><p>Step {step + 1} of 3</p></header>{body}
    <footer>{step > 0 && <button>Back</button>}<button>{step === 2 ? 'Create workspace' : 'Continue'}</button><a href="/skip">Skip for now</a></footer>
  </main>;
}
`
  ),
  page(
    'slot-heavy-layout',
    `
export function Page({ user, alerts, tasks }) {
  return <Shell {...shellProps}
    header={<Header logo={<span>Atlas</span>} account={<button>Signed in as {user.name}</button>}>Workspace <strong>{user.organization}</strong></Header>}
    sidebar={<Panel title={<h2>Quick links</h2>} footer={<small>Version {version}</small>}><a href="/tasks">Your tasks</a><a href="/team">Your team</a></Panel>}
    footer={() => <footer>Copyright {year}<a href="/privacy">Privacy policy</a></footer>}
    overlays={alerts.map(alert => <Toast key={alert.id} title={<b>Alert {alert.priority}</b>} action={<button>Dismiss</button>}>{alert.message}</Toast>)}>
    Main content <Grid empty={<p>No tasks assigned</p>} renderItem={task => <Card title={<h3>{task.title}</h3>} subtitle={<p>Due {task.due}</p>}>Assigned to {task.owner}</Card>}>{tasks}</Grid>
  </Shell>;
}
`
  ),
  page(
    'manual-translation-boundaries',
    `
export function Page({ user, records, condition }) {
  return <main><h1>Translation boundaries</h1>
    <ManualT>Welcome <b>{user.name}</b><ManualVar>{condition ? <i>Custom {user.note}</i> : <em>Default note</em>}</ManualVar></ManualT>
    <p>Automatically translated <ManualVar>{records.map(record => <Card key={record.id} header={<h2>Opaque {record.title}</h2>}>Opaque body {record.body}</Card>)}</ManualVar> until here {user.id}</p>
    <ManualT>{condition ? <span>Conditional manual {user.name}</span> : <span>Alternative manual</span>}</ManualT>
    <Card header={<ManualT>Manual heading</ManualT>} footer={<small>Auto footer {user.name}</small>}>Auto body</Card>
    <p>Amount <Currency>{condition ? <span>Computed amount</span> : user.balance}</Currency> and date <DateTime>{user.joined}</DateTime></p>
  </main>;
}
`
  ),
  page(
    'recursive-file-tree',
    `
function Tree({ node, ancestors = [] }) {
  if (node.type === 'file') return <li><button>Open <code>{node.name}</code></button><small>{node.size} bytes</small></li>;
  return <li><details open={node.open}><summary>Folder {node.name} ({node.children.length})</summary>
    <ul>{node.children.map(child => <Tree key={child.id} node={child} ancestors={[...ancestors, node.name]} />)}</ul>
    {node.children.length === 0 && <p>This folder is empty</p>}
  </details></li>;
}
export function Page({ root, selected }) {
  return <main><h1>Files in {root.name}</h1><ul><Tree node={root} /></ul>
    <aside>{selected ? <><h2>Selected file</h2><p>Name: {selected.name}</p><button>Download {selected.name}</button></> : <p>Select a file to see details</p>}</aside>
  </main>;
}
`
  ),
  page(
    'polymorphic-components',
    `
function Box({ as: Component = 'section', children, ...rest }) {
  return <Component {...rest}>{children}</Component>;
}
export function Page({ entries, headingLevel, expanded }) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return <Box as="main"><Heading>Flexible layout</Heading>
    {entries.map(entry => <Box as={entry.href ? 'a' : 'article'} key={entry.id} href={entry.href} title={<span>Details for {entry.name}</span>}>
      Entry <strong>{entry.name}</strong>{expanded ? <Box as="p">Expanded details: {entry.description}</Box> : <Box as="small">Show details</Box>}
    </Box>)}
    <UI.Toolbar><UI.Button icon={<UI.Icon><span>+</span></UI.Icon>}>Add entry</UI.Button><UI.Button>Close</UI.Button></UI.Toolbar>
  </Box>;
}
`
  ),
  page(
    'svg-report',
    `
export function Page({ values, width, height, title }) {
  return <figure><svg viewBox={'0 0 ' + width + ' ' + height} role="img" aria-labelledby="chart-title">
    <title id="chart-title">Revenue for {title}</title><desc>Monthly revenue compared with target</desc>
    <defs><linearGradient id="fill"><stop offset="0%" stopColor="green" /><stop offset="100%" stopColor="blue" /></linearGradient></defs>
    {values.map((point, index) => <g key={point.id} transform={'translate(' + index * 20 + ',0)'}><rect width={10} height={point.value} fill="url(#fill)" /><text y={height}>Month {index + 1}</text><title>{point.label}: {point.value}</title></g>)}
    <foreignObject width={200} height={50}><div>Target <strong>{target}</strong> reached {values.filter(point => point.value >= target).length} times</div></foreignObject>
  </svg><figcaption>Chart updated <DateTime>{updatedAt}</DateTime></figcaption></figure>;
}
`
  ),
  page(
    'async-error-recovery',
    `
async function Results({ query }) {
  const rows = await loadRows(query);
  return <section><h2>Results for {query}</h2>{rows.map(row => <p key={row.id}>Found {row.name}</p>)}</section>;
}
export async function Page({ params }) {
  const { query } = await params;
  return <main><h1>Live results</h1>
    <ErrorBoundary fallback={error => <section role="alert"><h2>Unable to load results</h2><p>Reason: {error.message}</p><button>Try again</button></section>}>
      <Suspense fallback={<p>Searching for {query}…</p>}><Results query={query} /></Suspense>
    </ErrorBoundary>
    <footer>Need help? <a href="/support">Contact support</a></footer>
  </main>;
}
`
  ),
  page(
    'notification-center',
    `
export function Page({ notifications, unread, filter }) {
  return <Drawer title={<h1>Notifications <span>{unread}</span></h1>} footer={<button>Mark all as read</button>}>
    <nav><button>All notifications</button><button>Unread only</button></nav>
    {notifications.filter(item => filter !== 'unread' || !item.read).map(item => <article key={item.id}>
      <Branch branch={item.kind} mention={<p><strong>{item.actor}</strong> mentioned you in {item.subject}.</p>} reminder={<p>Reminder: {item.subject}</p>} other={item.message} />
      <small>Received <DateTime>{item.createdAt}</DateTime></small>
      <div>{item.actions.map(action => <button key={action.id}>{action.label}</button>)}{!item.read && <button>Mark as read</button>}</div>
    </article>)}
    {!notifications.length && <p>You're all caught up!</p>}
  </Drawer>;
}
`
  ),
  page(
    'booking-itinerary',
    `
export function Page({ itinerary, travelers, options }) {
  return <main><h1>Your trip to {itinerary.destination}</h1>
    <ol>{itinerary.legs.map((leg, index) => <li key={leg.id}><h2>Leg {index + 1}: {leg.origin} to {leg.destination}</h2>
      <p>Departs <DateTime>{leg.departure}</DateTime>, arrives <DateTime>{leg.arrival}</DateTime></p>
      {leg.stops.length ? <ul>{leg.stops.map(stop => <li key={stop.id}>Stop in {stop.city} for {stop.duration} minutes</li>)}</ul> : <p>Direct service</p>}
    </li>)}</ol>
    <section><h2>Travelers</h2>{travelers.map(traveler => <p key={traveler.id}>{traveler.name} <Branch branch={traveler.type} adult="Adult" child="Child" infant="Infant" /></p>)}</section>
    <Card title={<h2>Extras</h2>}>{options.map(option => <label key={option.id}><input type="checkbox" checked={option.selected} />Add {option.label} for <Currency>{option.price}</Currency></label>)}</Card>
    <button>Confirm booking for {travelers.length} travelers</button>
  </main>;
}
`
  ),
  page(
    'pricing-comparison',
    `
export function Page({ plans, features, annual }) {
  return <main><h1>Find the right plan</h1><label><input type="checkbox" checked={annual} />Pay yearly and save {discount}%</label>
    <table><caption>Compare plans</caption><thead><tr><th>Features</th>{plans.map(plan => <th key={plan.id}><h2>{plan.name}</h2><p><Currency>{annual ? plan.annual : plan.monthly}</Currency> per month</p></th>)}</tr></thead>
      <tbody>{features.map(feature => <tr key={feature.id}><th>{feature.title}<Tooltip content={<p>About {feature.title}: {feature.help}</p>}><button>Learn more</button></Tooltip></th>
        {plans.map(plan => <td key={plan.id}>{plan.features[feature.id] === true ? <span>Included</span> : plan.features[feature.id] === false ? <span>Unavailable</span> : <span>Up to {plan.features[feature.id]}</span>}</td>)}
      </tr>)}</tbody>
      <tfoot><tr><th>Select a plan</th>{plans.map(plan => <td key={plan.id}><button>Choose {plan.name}</button></td>)}</tr></tfoot>
    </table>
  </main>;
}
`
  ),
  page(
    'markdown-renderers',
    `
const renderers = {
  heading: ({ level, children }) => level === 1 ? <h1>{children}</h1> : <h2>Section: {children}</h2>,
  callout: ({ tone, children }) => <aside><strong>{tone === 'warning' ? 'Warning' : 'Note'}:</strong>{children}</aside>,
  code: ({ language, children }) => <figure><figcaption>Code in {language}</figcaption><pre><ManualVar>{children}</ManualVar></pre></figure>,
  link: ({ href, children }) => <a href={href}>{children}<span> (opens link)</span></a>,
};
export function Page({ document }) {
  return <article><header><h1>{document.title}</h1><p>By {document.author}</p></header>
    {document.blocks.map(block => { const Render = renderers[block.type]; return Render ? <Render key={block.id} {...block.props}>{block.content}</Render> : <p key={block.id}>Unsupported block: {block.type}</p>; })}
    <footer>Last revised <DateTime>{document.updatedAt}</DateTime></footer>
  </article>;
}
`
  ),
  page(
    'product-catalog',
    `
export function Page({ categories, favorites, currency }) {
  return <main><h1>Shop the collection</h1>{categories.map(category => <section key={category.id}><h2>{category.name}</h2>
    <div>{category.products.map(product => <Card key={product.id} media={<img src={product.image} alt={product.name} />} title={<h3>{product.name}</h3>}>
      From <Currency currency={currency}>{product.price}</Currency>
      <p>{product.stock > 0 ? <>Only <strong>{product.stock}</strong> left in stock</> : <>Sold out <a href={product.notifyUrl}>Notify me</a></>}</p>
      <ul>{product.variants.map(variant => <li key={variant.id}><button>{variant.name} {variant.available ? '' : '(unavailable)'}</button></li>)}</ul>
      <button>{favorites.has(product.id) ? 'Remove from favorites' : 'Add to favorites'}</button>
    </Card>)}</div>
  </section>)}</main>;
}
`
  ),
  page(
    'social-feed',
    `
export function Page({ posts, currentUser }) {
  return <main><h1>Your feed</h1>{posts.map(post => <article key={post.id}>
    <header><a href={post.author.url}>{post.author.name}</a> posted <DateTime>{post.createdAt}</DateTime></header>
    <ManualVar><p>{post.body}</p>{post.attachments.map(attachment => <figure key={attachment.id}><img src={attachment.url} alt={attachment.alt} /><figcaption>{attachment.caption}</figcaption></figure>)}</ManualVar>
    <footer><button>{post.liked ? 'Unlike' : 'Like'} ({post.likes})</button><button>Reply to {post.author.name}</button></footer>
    <section><h2>Replies</h2>{post.replies.slice(0, 3).map(reply => <p key={reply.id}><strong>{reply.author}</strong>: <ManualVar>{reply.body}</ManualVar></p>)}{post.replies.length > 3 && <button>View all {post.replies.length} replies</button>}</section>
    {post.author.id === currentUser.id && <button>Edit your post</button>}
  </article>)}</main>;
}
`
  ),
  page(
    'multi-view-results',
    `
export function Page({ view, records, selected }) {
  const views = {
    list: <ul>{records.map(record => <li key={record.id}>Record {record.name}<button>Open</button></li>)}</ul>,
    grid: <div>{records.map(record => <Card key={record.id} title={<h2>{record.name}</h2>}>Created by {record.owner}</Card>)}</div>,
    compact: records.map(record => <Fragment key={record.id}><span>{record.name}</span>{' '}</Fragment>),
  };
  return <main><h1>Records</h1><p>{selected.size} selected</p>
    <Branch branch={view} list={views.list} grid={views.grid} compact={views.compact}><p>Choose a view</p></Branch>
    <section>{view in views ? views[view] : <p>Unknown view: {view}</p>}</section>
    <footer>Showing {records.length} records <button>Refresh</button></footer>
  </main>;
}
`
  ),
  page(
    'project-timeline',
    `
export function Page({ phases, now }) {
  return <main><h1>Project timeline</h1><ol>{phases.map((phase, index) => <li key={phase.id}>
    <h2>Phase {index + 1}: {phase.name}</h2><p>From <DateTime>{phase.start}</DateTime> to <DateTime>{phase.end}</DateTime></p>
    <Branch branch={phase.end < now ? 'complete' : phase.start > now ? 'upcoming' : 'active'} complete={<span>Completed</span>} upcoming={<span>Starts in {phase.daysUntil} days</span>} active={<span>In progress: {phase.progress}%</span>} />
    <ul>{phase.milestones.map(milestone => <li key={milestone.id}>{milestone.done ? <s>Completed {milestone.title}</s> : <><strong>{milestone.title}</strong> due {milestone.due}</>}</li>)}</ul>
    <p>Owner: {phase.owner?.name ?? <em>Unassigned</em>}</p>
  </li>)}</ol></main>;
}
`
  ),
  page(
    'support-ticket',
    `
export function Page({ ticket, suggestions, agents }) {
  return <Layout sidebar={<aside><h2>Ticket properties</h2><p>Status: {ticket.status}</p><label>Assign agent <select value={ticket.agentId}><option value="">Unassigned</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label></aside>}>
    <h1>Ticket #{ticket.number}: {ticket.subject}</h1><p>Opened by {ticket.customer.name}</p>
    <ManualVar>{ticket.messages.map(message => <article key={message.id}><h2>{message.author}</h2><p>{message.body}</p></article>)}</ManualVar>
    <section><h2>Suggested answers</h2>{suggestions.map(suggestion => <details key={suggestion.id}><summary>{suggestion.title}</summary><p>{suggestion.body}</p><button>Use answer</button></details>)}</section>
    <form><label>Your reply <textarea /></label><button>Send reply to {ticket.customer.name}</button><button>Close ticket</button></form>
  </Layout>;
}
`
  ),
  page(
    'order-fulfillment',
    `
export function Page({ order, packages }) {
  return <main><h1>Order {order.number}</h1><p>Thank you, {order.customer.name}!</p>
    {packages.map(parcel => <section key={parcel.id}><h2>Package {parcel.number} of {packages.length}</h2>
      <Branch branch={parcel.state} delivered={<p>Delivered on <DateTime>{parcel.deliveredAt}</DateTime></p>} transit={<p>Expected by <DateTime>{parcel.eta}</DateTime></p>} other={<p>Preparing your items</p>} />
      <ul>{parcel.items.map(item => <li key={item.id}>{item.quantity} × <strong>{item.name}</strong>{item.gift && <em>Gift wrapped</em>}</li>)}</ul>
      <details><summary>Tracking history</summary><ol>{parcel.events.map(event => <li key={event.id}><DateTime>{event.at}</DateTime> <Derive>{event.description}</Derive></li>)}</ol></details>
    </section>)}
    <footer><button>Download receipt</button><a href={order.supportUrl}>Get help with this order</a></footer>
  </main>;
}
`
  ),
  page(
    'explicit-children-and-spreads',
    `
export function Page({ state, overrides, items }) {
  const early = { children: <p>Spread child {state.early}</p>, title: <b>Spread title</b> };
  return <main>
    <Card {...early} children={<p>Explicit child {state.name}</p>} />
    <Card children={<p>Overridden child {state.name}</p>} {...overrides} />
    <Card {...overrides} children={['Leading ', state.name, <b key="em">emphasis {state.extra}</b>]} />
    <Card children={<span>Discarded prop {state.discarded}</span>}>Written children {state.written}</Card>
    <Card {...{ header: <h2>Object header {state.title}</h2>, children: [<p key="one">Object child</p>, ...items.map(item => <p key={item.id}>Item {item.name}</p>)] }} />
    <Card header={state.ok ? <h2>Success</h2> : <h2>Failure {state.reason}</h2>} children={[["Nested first", state.name], [<span key="two">Nested second</span>]]} />
  </main>;
}
`
  ),
  page(
    'whitespace-and-entities',
    `
export function Page({ first, last, count, value }) {
  return <main>
    <h1>Terms &amp; conditions</h1>
    <p>
      Welcome,
      <strong>{first}</strong>
      {last}
      !
    </p>
    <p>{first} {last}{' '}{value}</p>
    <p>&nbsp;{count}&#160;{value}</p>
    <p>&#x200b;{value}</p>
    <p>Use &lt;name&gt;, &quot;quoted text&quot;, and &#x1F30D;.</p>
    <pre>{'  First line\\n    Indented line\\n'}{value}{'\\n'}</pre>
    <p>日本語 <strong>{first}</strong> مرحباً <span dir="rtl">{last}</span></p>
    <p>Before{/* source-only note */}{value}{/* another note */}after</p>
    <p><span>A</span>
      <span>B</span></p>
  </main>;
}
`
  ),
  page(
    'typed-generic-renderers',
    `
type Row = { id: string; label: string; details?: string };
type PageProps = { rows: Row[]; selected?: Row; render?: (row: Row) => React.ReactNode };
const renderCell = <Item extends Row,>(item: Item) => <span>Cell {item.label}</span>;
export function Page({ rows, selected, render }: PageProps) {
  const fallback = (<strong>Unselected</strong> satisfies React.ReactNode);
  return <main><h1>Typed records</h1>
    <p>Selected: {(selected?.label ?? 'None') as string}</p>
    <p>Details: {selected!.details}</p>
    <ul>{rows.map((row: Row) => <li key={row.id}>{render?.(row) ?? renderCell(row)}{(row.details && <em>Details {row.details}</em>) as React.ReactNode}</li>)}</ul>
    <section>{(["Preview", selected ? <b key="selected">Current {selected.label}</b> : fallback] as const)}</section>
    <Render callback={(row: Row): React.ReactNode => <p>Callback {row.label}</p>} />
  </main>;
}
`
  ),
  page(
    'nested-opaque-branches',
    `
export function Page({ mode, count, user, status }) {
  return <main><h1>Message composition</h1>
    <p>Summary: <Branch branch={mode}
      compact={<><Plural n={count} one="One notification" other={<>{count} notifications</>} /> for {user.name}</>}
      detailed={<section><h2>Notifications for {user.name}</h2><Branch branch={status} active={<b>Active {count}</b>} other={getStatus()} /></section>}
      dynamic={status ? <span>Ready {count}</span> : <span>Waiting {user.name}</span>}>
      Default <Derive context={mode}><Branch branch={status} active="Active" other="Inactive" /></Derive>
    </Branch></p>
    <section><Derive>{() => <p>Deferred message for {user.name}</p>}</Derive></section>
    <p>Known <Static>{status ? <b>Static yes</b> : <i>Static no</i>}</Static> end</p>
  </main>;
}
`
  ),
  page(
    'array-and-generator-layout',
    `
function* cards(items) {
  yield <h2 key="heading">Generated cards</h2>;
  for (const item of items) yield <article key={item.id}>Generated {item.name}</article>;
}
export function Page({ items, left, right }) {
  return <main><h1>Collected content</h1>
    <section>{["Lead", [<p key="one">Nested one {left}</p>, [<p key="two">Deep two {right}</p>]], ...items.map(item => [<b key={item.id}>Mapped {item.name}</b>])]}</section>
    <section>Generator results {[...cards(items)]}</section>
    <section>{[, 'Sparse', , left, , <span key="tail">Tail {right}</span>]}</section>
    <section>{items.reduce((nodes, item) => [...nodes, <Fragment key={item.id}>Record {item.name}<br /></Fragment>], [])}</section>
    <footer>Finished {(track(items.length), items.length)} records</footer>
  </main>;
}
`
  ),
  page(
    'shadowed-manual-alias',
    `
function LocalPanel({ component: ManualT, componentVar: ManualVar, value }) {
  return <section><ManualT>Local translation-looking component {value}<span>Inner local {value}</span></ManualT>
    <ManualVar>Local variable-looking component {value}<span>Nested local {value}</span></ManualVar>
  </section>;
}
export function Page({ value, component, componentVar }) {
  return <main><h1>Scoped aliases</h1>
    <ManualT>Imported manual {value}<b>Manual child</b></ManualT>
    <p>Imported variable <ManualVar>{value}</ManualVar></p>
    <LocalPanel component={component} componentVar={componentVar} value={value} />
    {values.map(ManualT => <ManualT key={ManualT.id}>Mapped local {value}</ManualT>)}
    <p>After scope {value}</p>
  </main>;
}
`
  ),
];
