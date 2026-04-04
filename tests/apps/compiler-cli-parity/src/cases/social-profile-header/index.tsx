import { Plural, Num, Branch } from 'gt-react';

export default function SocialProfileHeader() {
  const user = {
    name: 'Alice Johnson',
    bio: 'Building the future of web development. Open source enthusiast.',
    location: 'San Francisco, CA',
    website: 'https://alice.dev',
    joinDate: 'March 2020',
    followers: 1234,
    following: 567,
    posts: 890,
    status: 'online',
    isOwnProfile: false,
    isFollowing: true,
  };

  return (
    <header>
      <div>
        <img src="/cover.jpg" alt="Cover photo" />
        <img src="/avatar.jpg" alt={user.name} />
      </div>

      <div>
        <div>
          <h1>{user.name}</h1>
          <Branch
            branch={user.status}
            online={<span>Online</span>}
            away={<span>Away</span>}
            offline={<span>Offline</span>}
          >
            <span>Unknown</span>
          </Branch>
        </div>

        {!user.isOwnProfile && (
          <div>
            <button>{user.isFollowing ? 'Unfollow' : 'Follow'}</button>
            <button>Message</button>
          </div>
        )}
      </div>

      <p>{user.bio}</p>

      <div>
        {user.location && <span>{user.location}</span>}
        {user.website && <a href={user.website}>{user.website}</a>}
        <span>Joined {user.joinDate}</span>
      </div>

      <div>
        <a href="/followers">
          <strong><Num>{user.followers}</Num></strong>{' '}
          <Plural n={user.followers} one="follower" other="followers" />
        </a>
        <a href="/following">
          <strong><Num>{user.following}</Num></strong> following
        </a>
        <span>
          <strong><Num>{user.posts}</Num></strong>{' '}
          <Plural n={user.posts} one="post" other="posts" />
        </span>
      </div>
    </header>
  );
}
